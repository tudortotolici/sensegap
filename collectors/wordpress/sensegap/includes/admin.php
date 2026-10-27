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
            <div class="notice notice-success"><p><?php printf(esc_html__('Connected to %s. Bot visits show up in SenseGap within minutes.', 'sensegap'), '<strong>' . esc_html($status['message']) . '</strong>'); ?></p></div>
        <?php elseif ($notice === 'error') : ?>
            <div class="notice notice-error"><p><?php printf(esc_html__('The key did not work: %s', 'sensegap'), esc_html($status['message'])); ?></p></div>
        <?php elseif ($notice === 'saved') : ?>
            <div class="notice notice-info"><p><?php esc_html_e('Saved.', 'sensegap'); ?></p></div>
        <?php endif; ?>

        <?php if ($caches) : ?>
            <div class="notice notice-warning"><p><?php printf(
                esc_html__('This site uses %s. Cached pages are served without running WordPress, so bot visits to them are missed. If the site is on Cloudflare, the Cloudflare install sees every visit.', 'sensegap'),
                '<strong>' . esc_html(implode(', ', $caches)) . '</strong>'
            ); ?></p></div>
        <?php endif; ?>

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
