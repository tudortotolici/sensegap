<?php
if (!defined('ABSPATH')) exit;

add_action('admin_menu', function () {
    add_options_page('SenseGap', 'SenseGap', 'manage_options', 'sensegap', 'sensegap_settings_page');
});

add_filter('plugin_action_links_' . plugin_basename(SENSEGAP_FILE), function ($links) {
    array_unshift($links, '<a href="' . esc_url(admin_url('options-general.php?page=sensegap')) . '">' . esc_html__('Settings', 'sensegap') . '</a>');
    return $links;
});

/** Asks SenseGap which site the key belongs to. Returns [ok, message]. */
function sensegap_check_key($key) {
    $url = str_replace('/v1/events', '/v1/check', SENSEGAP_INGEST_URL) . '?source=wordpress';
    $res = wp_remote_get($url, ['timeout' => 8, 'headers' => ['Authorization' => 'Bearer ' . $key, 'User-Agent' => 'SenseGap-WordPress/' . SENSEGAP_VERSION]]);
    if (is_wp_error($res)) return [false, sprintf(__('Could not reach SenseGap: %s', 'sensegap'), $res->get_error_message())];
    $body = json_decode(wp_remote_retrieve_body($res), true);
    if (wp_remote_retrieve_response_code($res) === 200 && !empty($body['site'])) return [true, $body['site']];
    return [false, !empty($body['error']) ? $body['error'] : sprintf(__('SenseGap answered %d', 'sensegap'), wp_remote_retrieve_response_code($res))];
}

/*
 * One-click connect. Nothing is sent to SenseGap until someone clicks the button.
 * 1. The button stores a random secret and opens sensegap.com with its SHA-256 (the "challenge").
 * 2. After approval, SenseGap sends the browser back here with a one-time code.
 * 3. This server trades the code plus the secret for a site key. A code seen in a URL is useless without the secret.
 */
add_action('admin_post_sensegap_connect', function () {
    if (!current_user_can('manage_options')) wp_die(esc_html__('You are not allowed to do this.', 'sensegap'));
    check_admin_referer('sensegap_connect');
    $verifier = wp_generate_password(64, false);
    $state = wp_generate_password(32, false);
    set_transient('sensegap_connect_' . get_current_user_id(), ['verifier' => $verifier, 'state' => $state], 15 * MINUTE_IN_SECONDS);
    $url = add_query_arg(array_map('rawurlencode', [
        'site'      => (string) wp_parse_url(home_url(), PHP_URL_HOST),
        'return'    => admin_url('options-general.php?page=sensegap'),
        'state'     => $state,
        'challenge' => rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='),
        'tz'        => function_exists('wp_timezone_string') ? wp_timezone_string() : 'UTC',
    ]), SENSEGAP_APP_URL . '/connect/wordpress');
    add_filter('allowed_redirect_hosts', function ($hosts) {
        $hosts[] = (string) wp_parse_url(SENSEGAP_APP_URL, PHP_URL_HOST);
        return $hosts;
    });
    wp_safe_redirect($url);
    exit;
});

/** Back from sensegap.com: trade the one-time code for a key, then show the settings page without the code in the URL. */
add_action('admin_init', function () {
    if (!isset($_GET['page'], $_GET['sensegap_state']) || $_GET['page'] !== 'sensegap' || !current_user_can('manage_options')) return;
    $uid = get_current_user_id();
    $pending = get_transient('sensegap_connect_' . $uid);
    delete_transient('sensegap_connect_' . $uid);
    $state = sanitize_text_field(wp_unslash($_GET['sensegap_state']));
    $result = 'error';
    $message = '';

    if (!is_array($pending) || !hash_equals((string) $pending['state'], $state)) {
        $message = __('This connect link expired or was opened in another browser. Click Connect to SenseGap again.', 'sensegap');
    } elseif (isset($_GET['sensegap_error'])) {
        $result = 'cancelled';
    } else {
        $code = isset($_GET['sensegap_code']) ? sanitize_text_field(wp_unslash($_GET['sensegap_code'])) : '';
        $res = wp_remote_post(SENSEGAP_APP_URL . '/api/connect/wordpress', [
            'timeout' => 15,
            'headers' => ['Content-Type' => 'application/json', 'User-Agent' => 'SenseGap-WordPress/' . SENSEGAP_VERSION],
            'body'    => wp_json_encode(['code' => $code, 'verifier' => $pending['verifier']]),
        ]);
        $body = is_wp_error($res) ? null : json_decode(wp_remote_retrieve_body($res), true);
        if (is_wp_error($res)) {
            $message = sprintf(__('Could not reach SenseGap: %s', 'sensegap'), $res->get_error_message());
        } elseif (wp_remote_retrieve_response_code($res) !== 200 || empty($body['key'])) {
            $message = !empty($body['error']) ? $body['error'] : sprintf(__('SenseGap answered %d', 'sensegap'), wp_remote_retrieve_response_code($res));
        } else {
            $o = get_option('sensegap', []);
            $o = is_array($o) ? $o : [];
            // SenseGap just issued this key for this site, so no separate check is needed.
            $o['key'] = sanitize_text_field($body['key']);
            $o['status'] = ['ok' => true, 'message' => sanitize_text_field($body['site']), 'at' => time()];
            update_option('sensegap', $o, true);
            $result = 'connected';
        }
    }
    if ($message) set_transient('sensegap_notice_' . $uid, $message, 5 * MINUTE_IN_SECONDS);
    wp_safe_redirect(admin_url('options-general.php?page=sensegap&sensegap_connected=' . $result));
    exit;
});

/** Page caches serve pages without running WordPress, so those visits never reach the plugin. */
function sensegap_cache_plugins() {
    $known = [
        'wp-rocket/wp-rocket.php' => 'WP Rocket', 'litespeed-cache/litespeed-cache.php' => 'LiteSpeed Cache',
        'w3-total-cache/w3-total-cache.php' => 'W3 Total Cache', 'wp-super-cache/wp-cache.php' => 'WP Super Cache',
        'wp-fastest-cache/wpFastestCache.php' => 'WP Fastest Cache', 'cache-enabler/cache-enabler.php' => 'Cache Enabler',
        'sg-cachepress/sg-cachepress.php' => 'SiteGround Optimizer', 'breeze/breeze.php' => 'Breeze', 'hummingbird-performance/wp-hummingbird.php' => 'Hummingbird',
    ];
    $active = (array) get_option('active_plugins', []);
    $found = [];
    foreach ($known as $file => $name) if (in_array($file, $active, true)) $found[] = $name;
    if (!$found && defined('WP_CACHE') && WP_CACHE) $found[] = __('a page cache (WP_CACHE is on)', 'sensegap');
    return $found;
}

function sensegap_settings_page() {
    if (!current_user_can('manage_options')) return;
    $notice = null;

    if (isset($_POST['sensegap_save']) && check_admin_referer('sensegap_settings')) {
        $o = get_option('sensegap', []);
        $o = is_array($o) ? $o : [];
        $key = isset($_POST['sensegap_key']) ? trim(sanitize_text_field(wp_unslash($_POST['sensegap_key']))) : '';
        if ($key !== '' && strpos($key, '•') === false) $o['key'] = $key;
        if (isset($_POST['sensegap_remove_key'])) $o['key'] = '';
        $ip = isset($_POST['sensegap_ip_source']) ? sanitize_key($_POST['sensegap_ip_source']) : 'auto';
        $o['ip_source'] = in_array($ip, ['auto', 'remote', 'cf', 'xff', 'xri'], true) ? $ip : 'auto';
        if (!empty($o['key'])) {
            list($ok, $msg) = sensegap_check_key($o['key']);
            $o['status'] = ['ok' => $ok, 'message' => $msg, 'at' => time()];
        } else {
            $o['status'] = null;
        }
        update_option('sensegap', $o, true);
        $notice = !empty($o['key']) ? ($o['status']['ok'] ? 'connected' : 'error') : 'saved';
    }

    // Back from one-click connect (see admin_init above).
    if ($notice === null && isset($_GET['sensegap_connected'])) {
        $notice = sanitize_key($_GET['sensegap_connected']);
        $connect_error = get_transient('sensegap_notice_' . get_current_user_id());
        delete_transient('sensegap_notice_' . get_current_user_id());
    }

    $key = sensegap_option('key');
    $status = sensegap_option('status', null);
    $ip_source = sensegap_option('ip_source', 'auto');
    $caches = sensegap_cache_plugins();
    $masked = $key ? substr($key, 0, 12) . str_repeat('•', 12) : '';
    ?>
    <div class="wrap">
        <h1>SenseGap</h1>
        <p><?php esc_html_e('See which AI bots read your site. Only bot requests and visits sent by AI products leave your site; human traffic is filtered out here.', 'sensegap'); ?></p>

        <?php if ($notice === 'connected') : ?>
            <div class="notice notice-success"><p><?php printf(esc_html__('Connected to %s. Bot visits show up in SenseGap within minutes.', 'sensegap'), '<strong>' . esc_html($status ? $status['message'] : '') . '</strong>'); ?></p></div>
        <?php elseif ($notice === 'error') : ?>
            <div class="notice notice-error"><p><?php echo !empty($connect_error)
                ? sprintf(esc_html__('Could not connect: %s', 'sensegap'), esc_html($connect_error))
                : sprintf(esc_html__('The key did not work: %s', 'sensegap'), esc_html($status ? $status['message'] : '')); ?></p></div>
        <?php elseif ($notice === 'cancelled') : ?>
            <div class="notice notice-info"><p><?php esc_html_e('Connection cancelled. Nothing was changed.', 'sensegap'); ?></p></div>
        <?php elseif ($notice === 'saved') : ?>
            <div class="notice notice-info"><p><?php esc_html_e('Saved.', 'sensegap'); ?></p></div>
        <?php endif; ?>

        <?php if ($caches) : ?>
            <div class="notice notice-warning"><p><?php printf(
                esc_html__('This site uses %s. Cached pages are served without running WordPress, so bot visits to them are missed. If the site is on Cloudflare, the Cloudflare install sees every visit.', 'sensegap'),
                '<strong>' . esc_html(implode(', ', $caches)) . '</strong>'
            ); ?></p></div>
        <?php endif; ?>

        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin: 16px 0 8px;">
            <input type="hidden" name="action" value="sensegap_connect">
            <?php wp_nonce_field('sensegap_connect'); ?>
            <?php if ($key) : ?>
                <button type="submit" class="button"><?php esc_html_e('Connect again', 'sensegap'); ?></button>
                <span class="description" style="margin-left: 8px;"><?php esc_html_e('Gets a new site key from SenseGap.', 'sensegap'); ?></span>
            <?php else : ?>
                <button type="submit" class="button button-primary button-hero"><?php esc_html_e('Connect to SenseGap', 'sensegap'); ?></button>
                <p class="description"><?php esc_html_e('Sign in to SenseGap and approve. The site key is set up for you. Or paste a key below.', 'sensegap'); ?></p>
            <?php endif; ?>
        </form>

        <form method="post">
            <?php wp_nonce_field('sensegap_settings'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="sensegap_key"><?php esc_html_e('Site key', 'sensegap'); ?></label></th>
                    <td>
                        <input name="sensegap_key" id="sensegap_key" type="text" class="regular-text code" autocomplete="off" spellcheck="false" placeholder="sg_live_…" value="<?php echo esc_attr($masked); ?>">
                        <p class="description"><?php printf(esc_html__('From SenseGap → Install & settings → WordPress. %s', 'sensegap'), '<a href="https://sensegap.com/app" target="_blank" rel="noopener">sensegap.com/app</a>'); ?></p>
                        <?php if ($status) : ?>
                            <p><?php echo $status['ok']
                                ? '<span style="color:#008a20">●</span> ' . sprintf(esc_html__('Connected to %s', 'sensegap'), '<strong>' . esc_html($status['message']) . '</strong>')
                                : '<span style="color:#d63638">●</span> ' . esc_html($status['message']); ?>
                                <span class="description"> · <?php printf(esc_html__('checked %s ago', 'sensegap'), esc_html(human_time_diff((int) $status['at']))); ?></span></p>
                        <?php endif; ?>
                        <?php if ($key) : ?><label><input type="checkbox" name="sensegap_remove_key" value="1"> <?php esc_html_e('Remove the key (stops sending)', 'sensegap'); ?></label><?php endif; ?>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="sensegap_ip_source"><?php esc_html_e('Visitor IP', 'sensegap'); ?></label></th>
                    <td>
                        <select name="sensegap_ip_source" id="sensegap_ip_source">
                            <?php foreach ([
                                'auto'   => __('Automatic (recommended)', 'sensegap'),
                                'remote' => __('Direct connection (REMOTE_ADDR)', 'sensegap'),
                                'cf'     => __('Cloudflare (CF-Connecting-IP)', 'sensegap'),
                                'xff'    => __('Proxy or load balancer (X-Forwarded-For)', 'sensegap'),
                                'xri'    => __('nginx proxy (X-Real-IP)', 'sensegap'),
                            ] as $value => $label) : ?>
                                <option value="<?php echo esc_attr($value); ?>" <?php selected($ip_source, $value); ?>><?php echo esc_html($label); ?></option>
                            <?php endforeach; ?>
                        </select>
                        <p class="description"><?php esc_html_e('SenseGap checks each bot against its IP to tell real crawlers from fakes. Automatic trusts proxy headers only when the request really came through Cloudflare or a private proxy.', 'sensegap'); ?></p>
                    </td>
                </tr>
            </table>
            <p class="submit"><button type="submit" name="sensegap_save" value="1" class="button button-primary"><?php esc_html_e('Save and check key', 'sensegap'); ?></button></p>
        </form>
    </div>
    <?php
}
