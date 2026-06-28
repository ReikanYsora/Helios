//Custom-card registration for the HA card picker. Runs once at import: overwrites (not insert-if-missing) the entry
//so the freshly-loaded bundle's metadata always wins. Card name/description show before any hass exists, so language
//comes from navigator.
import { pickTranslations } from '../i18n';

declare global
{
    interface Window
    {
        customCards?: {
            type:        string;
            name:        string;
            description: string;
            preview?:    boolean;
        }[];
    }
}

const _bootI18n = pickTranslations(typeof navigator !== 'undefined' ? navigator.language : 'en');

//Overwrite any stale entry pushed by other code (HACS placeholder, dev-tools mock, an older bundle on the same page).
window.customCards = window.customCards || [];
{
    const heliosEntry =
    {
        type:        'helios-card',
        name:        _bootI18n.cardName,
        description: _bootI18n.cardDescription,
        preview:     true,
    };
    const existingIdx = window.customCards.findIndex(c => c.type === 'helios-card');
    if (existingIdx >= 0)
    {
        window.customCards[existingIdx] = heliosEntry;
    }
    else
    {
        window.customCards.push(heliosEntry);
    }
}
