//Card-picker registration for the Energy Fingerprint. Runs once at import; overwrites any stale entry so the
//freshly loaded bundle's metadata wins. Name/description show before any hass exists, so language is unavailable
//here and the text stays in English (the card itself localises at runtime). The `window.customCards` global type
//is declared once in card/registry.ts and reused here.

export {};

const entry =
{
    type:        'helios-fingerprint-card',
    name:        'Helios Energy Fingerprint',
    description: 'A heatmap of your home\'s energy habits: intensity is consumption, colour is solar coverage.',
    preview:     true,
};

window.customCards = window.customCards || [];
const idx = window.customCards.findIndex(c => c.type === 'helios-fingerprint-card');
if (idx >= 0) { window.customCards[idx] = entry; }
else { window.customCards.push(entry); }
