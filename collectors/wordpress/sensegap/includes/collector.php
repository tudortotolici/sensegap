<?php
if (!defined('ABSPATH')) exit;

/** Cloudflare's published ranges (cloudflare.com/ips). CF-Connecting-IP is trusted only from these. */
const SENSEGAP_CLOUDFLARE = [
    '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
    '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
    '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
    '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
];

function sensegap_ip_in($ip, $cidr) {
    list($net, $bits) = array_pad(explode('/', $cidr, 2), 2, null);
    $a = @inet_pton($ip);
    $b = @inet_pton($net);
    if ($a === false || $b === false || strlen($a) !== strlen($b)) return false;
    $bits = $bits === null ? strlen($a) * 8 : (int) $bits;
    $bytes = intdiv($bits, 8);
    if (substr($a, 0, $bytes) !== substr($b, 0, $bytes)) return false;
    $rest = $bits % 8;
    if ($rest === 0) return true;
    $mask = 0xff << (8 - $rest) & 0xff;
    return (ord($a[$bytes]) & $mask) === (ord($b[$bytes]) & $mask);
}

function sensegap_is_private($ip) {
    return !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
}

function sensegap_header($name) {
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return isset($_SERVER[$key]) && $_SERVER[$key] !== '' ? sanitize_text_field(wp_unslash($_SERVER[$key])) : null;
}

/**
 * The visitor's IP. Headers a bot could fake are only trusted when the request really came
 * through the proxy that sets them; otherwise a fake Googlebot could pass verification.
 */
function sensegap_client_ip() {
    $remote = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '';
    $mode = sensegap_option('ip_source', 'auto');
    $first = function ($v) { return $v === null ? null : trim(explode(',', $v)[0]); };

    if ($mode === 'remote') return $remote;
    if ($mode === 'cf') return sensegap_header('CF-Connecting-IP') ?: $remote;
    if ($mode === 'xff') return $first(sensegap_header('X-Forwarded-For')) ?: $remote;
    if ($mode === 'xri') return sensegap_header('X-Real-IP') ?: $remote;

    // auto
    $cf = sensegap_header('CF-Connecting-IP');
    if ($cf) {
        foreach (SENSEGAP_CLOUDFLARE as $range) {
            if (sensegap_ip_in($remote, $range)) return $cf;
        }
    }
    if ($remote !== '' && sensegap_is_private($remote)) {
        $fwd = $first(sensegap_header('X-Forwarded-For')) ?: sensegap_header('X-Real-IP');
        if ($fwd) return $fwd;
    }
    return $remote;
}

/** Same rule as every SenseGap collector: bots (known or not) and humans sent by AI products. */
function sensegap_should_send($path, $ua, $referer, $url, $signature_agent) {
    if (strpos($path, '/cdn-cgi/') === 0) return false;
    if ($ua !== null && strpos($ua, 'SenseGap-') === 0) return false;
    if ($signature_agent) {
        foreach (SENSEGAP_SIGNATURE_AGENTS as $re) if (preg_match($re, trim($signature_agent))) return true;
    }
    if ($ua === null || $ua === '') return true;
    foreach (SENSEGAP_BOT_UA as $re) if (preg_match($re, $ua)) return true;
    if (preg_match(SENSEGAP_GENERIC_BOT, $ua)) return true;

    $hosts = SENSEGAP_AI_HOSTS;
    if ($referer) {
        $h = strtolower((string) wp_parse_url($referer, PHP_URL_HOST));
        if ($h && (in_array($h, $hosts, true) || in_array(preg_replace('/^www\./', '', $h), $hosts, true))) return true;
    }
    $query = (string) wp_parse_url($url, PHP_URL_QUERY);
    if ($query !== '') {
        parse_str($query, $q);
        if (isset($q['utm_source']) && is_string($q['utm_source']) && in_array(strtolower($q['utm_source']), $hosts, true)) return true;
    }
    return false;
}

/** Runs at the very end of each request, after the page is built. */
function sensegap_capture() {
    $key = sensegap_option('key');
    if (!$key) return;
    if ((defined('DOING_CRON') && DOING_CRON) || (defined('WP_CLI') && WP_CLI)) return;
    if (function_exists('is_user_logged_in') && is_user_logged_in()) return; // people who log in are people

    $uri = isset($_SERVER['REQUEST_URI']) ? esc_url_raw(wp_unslash($_SERVER['REQUEST_URI'])) : '/';
    $host = isset($_SERVER['HTTP_HOST']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_HOST'])) : (string) wp_parse_url(home_url(), PHP_URL_HOST);
    $url = (is_ssl() ? 'https' : 'http') . '://' . $host . $uri;
    $path = (string) wp_parse_url($url, PHP_URL_PATH);
    $ua = sensegap_header('User-Agent');
    $referer = sensegap_header('Referer');
    $signature_agent = sensegap_header('Signature-Agent');

    try {
        if (!sensegap_should_send($path, $ua, $referer, $url, $signature_agent)) return;
        $ip = sensegap_client_ip();
        if (!$ip) return;

        $start = isset($_SERVER['REQUEST_TIME_FLOAT']) ? (float) $_SERVER['REQUEST_TIME_FLOAT'] : microtime(true);
        $status = http_response_code();
        $event = [
            'ts'             => (int) round($start * 1000),
            'method'         => isset($_SERVER['REQUEST_METHOD']) ? substr(sanitize_text_field(wp_unslash($_SERVER['REQUEST_METHOD'])), 0, 16) : 'GET',
            'url'            => $url,
            'status'         => is_int($status) ? $status : null,
            'ip'             => $ip,
            'ua'             => $ua,
            'referer'        => $referer,
            'signatureAgent' => $signature_agent,
            'asn'            => null,
            'country'        => sensegap_header('CF-IPCountry'),
            'ms'             => (int) round((microtime(true) - $start) * 1000),
        ];

        // Hand the page to the visitor first when PHP-FPM allows it, then send.
        $finished = function_exists('fastcgi_finish_request') && fastcgi_finish_request();
        wp_remote_post(SENSEGAP_INGEST_URL, [
            'timeout'  => $finished ? 3 : 0.5,
            'blocking' => $finished,
            'headers'  => ['Content-Type' => 'application/json', 'Authorization' => 'Bearer ' . $key, 'User-Agent' => 'SenseGap-WordPress/' . SENSEGAP_VERSION],
            'body'     => wp_json_encode(['v' => 1, 'source' => 'wordpress', 'events' => [$event]]),
        ]);
    } catch (\Throwable $e) {
        // Never break the site over analytics.
    }
}
