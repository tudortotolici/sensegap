<?php
// Runs the plugin's request filter and IP logic without WordPress.
//   php collectors/wordpress/test/collector-test.php
define('ABSPATH', __DIR__);
$GLOBALS['opts'] = [];
function get_option($n, $d = []) { return $GLOBALS['opts']; }
function wp_unslash($v) { return $v; }
function sanitize_text_field($v) { return trim(preg_replace('/[\r\n\t ]+/', ' ', strip_tags((string) $v))); }
function esc_url_raw($v) { return (string) $v; }
function wp_parse_url($u, $c = -1) { return parse_url($u, $c); }
function sensegap_option($n, $d = '') { return isset($GLOBALS['opts'][$n]) ? $GLOBALS['opts'][$n] : $d; }
require __DIR__ . '/../sensegap/includes/patterns.php';
require __DIR__ . '/../sensegap/includes/collector.php';

$fail = 0;
function check($name, $got, $want) {
    global $fail;
    if ($got === $want) { echo "ok   $name\n"; return; }
    $fail++;
    echo "FAIL $name: got " . var_export($got, true) . ", want " . var_export($want, true) . "\n";
}

$chrome = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/141.0 Safari/537.36';
$send = function ($ua, $ref = null, $url = 'https://x.com/a', $sig = null) {
    return sensegap_should_send((string) parse_url($url, PHP_URL_PATH), $ua, $ref, $url, $sig);
};
check('GPTBot', $send('Mozilla/5.0; compatible; GPTBot/1.2; +https://openai.com/gptbot'), true);
check('ChatGPT-User', $send('Mozilla/5.0 AppleWebKit/537.36; compatible; ChatGPT-User/1.0'), true);
check('unknown crawler', $send('mcpbeat/0.3 (+https://mcpbeat.dev)'), true);
check('curl', $send('curl/8.4.0'), true);
check('empty UA', $send(''), true);
check('plain human', $send($chrome), false);
check('human from ChatGPT', $send($chrome, 'https://chatgpt.com/'), true);
check('human from www.perplexity.ai', $send($chrome, 'https://www.perplexity.ai/search'), true);
check('utm_source=chatgpt.com', $send($chrome, null, 'https://x.com/a?utm_source=chatgpt.com'), true);
check('utm_source=newsletter', $send($chrome, null, 'https://x.com/a?utm_source=newsletter'), false);
check('Signature-Agent', $send($chrome, null, 'https://x.com/a', '"https://chatgpt.com"'), true);
check('own fetcher', $send('SenseGap-Titles/1.0 (+https://sensegap.com)'), false);
check('cdn-cgi', $send('GPTBot/1.2', null, 'https://x.com/cdn-cgi/challenge'), false);

check('ipv4 in range', sensegap_ip_in('104.16.5.4', '104.16.0.0/13'), true);
check('ipv4 out of range', sensegap_ip_in('104.24.0.1', '104.16.0.0/13'), false);
check('ipv4 odd prefix', sensegap_ip_in('131.0.75.255', '131.0.72.0/22'), true);
check('ipv6 in range', sensegap_ip_in('2606:4700:10::6816:1', '2606:4700::/32'), true);
check('ipv6 vs ipv4', sensegap_ip_in('2606:4700::1', '104.16.0.0/13'), false);

$_SERVER = ['REMOTE_ADDR' => '203.0.113.9', 'HTTP_CF_CONNECTING_IP' => '66.249.66.1', 'HTTP_X_FORWARDED_FOR' => '66.249.66.1'];
check('auto: fake headers from the open internet are ignored', sensegap_client_ip(), '203.0.113.9');
$_SERVER['REMOTE_ADDR'] = '162.158.1.2';
check('auto: CF-Connecting-IP from Cloudflare', sensegap_client_ip(), '66.249.66.1');
$_SERVER = ['REMOTE_ADDR' => '10.0.0.5', 'HTTP_X_FORWARDED_FOR' => '66.249.66.1, 10.0.0.2'];
check('auto: X-Forwarded-For from a private proxy', sensegap_client_ip(), '66.249.66.1');
$GLOBALS['opts'] = ['ip_source' => 'remote'];
check('forced REMOTE_ADDR', sensegap_client_ip(), '10.0.0.5');

echo $fail ? "\n$fail failed\n" : "\nall passed\n";
exit($fail ? 1 : 0);
