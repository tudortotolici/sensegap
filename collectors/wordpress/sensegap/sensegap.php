<?php
/**
 * Plugin Name:       SenseGap
 * Plugin URI:        https://sensegap.com
 * Description:       See which AI bots read your site: what they read, how often, and which ones are real. Only bot requests and visits from AI products are sent; human traffic never leaves your site.
 * Version:           0.1.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            SenseGap
 * Author URI:        https://sensegap.com
 * License:           MIT
 * License URI:       https://opensource.org/licenses/MIT
 * Text Domain:       sensegap
 */

if (!defined('ABSPATH')) exit;

define('SENSEGAP_VERSION', '0.1.0');
define('SENSEGAP_FILE', __FILE__);
if (!defined('SENSEGAP_INGEST_URL')) define('SENSEGAP_INGEST_URL', 'https://ingest.sensegap.com/v1/events');

require_once __DIR__ . '/includes/patterns.php';
require_once __DIR__ . '/includes/collector.php';
if (is_admin()) require_once __DIR__ . '/includes/admin.php';

/** Plugin settings: key, where the visitor IP comes from, last key check. */
function sensegap_option($name, $default = '') {
    $o = get_option('sensegap', []);
    return is_array($o) && isset($o[$name]) ? $o[$name] : $default;
}

add_action('shutdown', 'sensegap_capture', PHP_INT_MAX);
