/**
 * GERADO — não editar à mão.
 * Fonte: src/features/gestor/dende-icons.css (Fontello do Dendê, 321 glifos).
 * Regenerar: scripts do passe de conformidade (ver docs/auditoria-conformidade.md).
 *
 * 146 nomes seguem o padrão `icon-dende-icons-<nome>-<filled|outlined>`.
 * Fora do padrão, e por isso ausentes deste tipo: `dende-check-required`, `dende-draw-outlined`, `dende-icons-brand-watermark`, `dende-icons-collections-bookmark`, `dende-icons-devices`, `dende-icons-download-for-offline`, `dende-icons-downloading`, `dende-icons-drag-handle`, `dende-icons-edit_calendar-filled-1`, `dende-icons-edit_calendar-outlined-1`, `dende-icons-flow-chart`, `dende-icons-forward-10-seconds`, `dende-icons-gps-fixed`, `dende-icons-insights-filled-1`, `dende-icons-insights-outlined-1`, `dende-icons-keyboard-double-arrow-up`, `dende-icons-mental-maps`, `dende-icons-piggy-illed`, `dende-icons-play`, `dende-icons-rewind-10-seconds`, `dende-icons-star-rate_filled`, `dende-icons-stop`, `dende-icons-strike-filled-1`, `dende-icons-subscriptions-filled-1`, `dende-icons-subscriptions-outlined-1`, `dende-icons-suport_agent-filled-1`, `dende-icons-suport_agent-outlined-1`, `dende-library-add`, `dende-link-address`, `dende-pix-outlined`, `dende-post-add-filled`, `dende-post-add-outlined`, `dende-trending-down-filled`, `dende-trending-down-outlined`, `dende-trending-flat-filled`, `dende-trending-flat-outlined`, `dende-trending-up-filled`, `dende-trending-up-outlined`, `dende-upload-file-filled`, `room-filled`, `room-outlined`.
 */

/** Nomes de ícone do Dendê que existem na fonte. Nome inválido é erro de compilação. */
export const DENDE_ICON_NAMES = [
  'account_circle', 'add', 'add_circle_outline', 'android_share',
  'apps', 'arrow_back', 'arrow_downward', 'arrow_drop_down',
  'arrow_drop_up', 'arrow_forward', 'arrow_left', 'arrow_right',
  'arrow_upward', 'attach_file', 'attach_money', 'auto-awesome-motion',
  'auto_awesome', 'auto_stories', 'block', 'calendar_mont',
  'calendar_month', 'campaign', 'cancel', 'check',
  'check-circle', 'check_box', 'check_box_outline_blank', 'chevron_left',
  'chevron_right', 'clear', 'close', 'cloud',
  'cloud_done', 'cloud_download', 'cloud_off', 'cloud_upload',
  'content_copy', 'credit_card', 'dark-mode', 'date-picker',
  'delete', 'documents', 'done', 'download',
  'download-for-offline', 'edit-note', 'edit_calendar', 'email',
  'equalizer', 'error', 'error_outline', 'expand_less',
  'expand_more', 'fast_forward', 'fast_rewind', 'filter_list',
  'filter_list_off', 'first_page', 'flag', 'folder',
  'format-list-bullet', 'format_strikethrough', 'forward_10', 'fullscreen',
  'fullscreen_exit', 'groups', 'health-and-safety', 'highlight',
  'home', 'indetermine_check_box', 'info', 'insights',
  'ios_share', 'key', 'key_off', 'last_page',
  'library-books', 'light-mode', 'lock-open', 'login',
  'logout', 'menu', 'mode_edit', 'more_horiz',
  'more_vert', 'notifications', 'open_in_new', 'padlock',
  'pause', 'pause_circle', 'piggy', 'play_arrow',
  'play_circle', 'play_disabled', 'publish', 'push_pin',
  'quiz', 'radio_button_checked', 'radio_button_unchecked', 'receipt_long',
  'redo', 'refresh', 'remove', 'remove_circle_outline',
  'replay_10', 'report_problem', 'save_alt', 'schedule',
  'school', 'search', 'settings', 'skip_next',
  'skip_previous', 'slideshow', 'spinner', 'star',
  'star_border', 'star_half', 'star_outline', 'star_rate',
  'strike', 'subscriptions', 'suport_agent', 'thumb_down',
  'thumb_up', 'timeline', 'timer', 'toggle_off',
  'toggle_on', 'touch-app', 'undo', 'unfold_less',
  'unfold_more', 'upload', 'vaccines', 'video-library',
  'videocam', 'visibility', 'visibility_off', 'volume_down',
  'volume_mute', 'volume_off', 'volume_up', 'watch-later',
  'whatsapp', 'workspace_premium',
] as const;

export type DendeIconName = (typeof DENDE_ICON_NAMES)[number];

/** Gramática do handoff §3: `-filled` = ativo/selecionado, `-outlined` = default. */
export type DendeIconVariant = 'filled' | 'outlined';

/**
 * Glifos que só existem em UMA variante. Pedir a variante que falta renderiza
 * tofu — o `<Icon>` cai para a variante existente e avisa em desenvolvimento.
 */
export const SOMENTE_FILLED: ReadonlySet<string> = new Set([
  'calendar_month', 'strike', 'timeline',
]);

export const SOMENTE_OUTLINED: ReadonlySet<string> = new Set([
  'auto_awesome', 'calendar_mont', 'check', 'date-picker',
  'download-for-offline', 'highlight', 'lock-open', 'piggy',
  'star_rate',
]);

/** Classe CSS de um par nome+variante, já resolvida contra o que a fonte tem. */
export function classeDoIcone(nome: DendeIconName, variante: DendeIconVariant): string {
  const efetiva: DendeIconVariant = SOMENTE_FILLED.has(nome)
    ? 'filled'
    : SOMENTE_OUTLINED.has(nome)
      ? 'outlined'
      : variante;
  return `icon-dende-icons-${nome}-${efetiva}`;
}
