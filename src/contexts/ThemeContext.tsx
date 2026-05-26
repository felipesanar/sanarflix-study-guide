import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Logger } from '@/utils/logger';

export interface ThemeColors {
    brand: {
        primary: string;
        secondary: string;
        accent?: string;
    };
    ui: {
        background: string;
        surface?: string;
        border?: string;
    };
    text?: {
        main: string;
        inverse: string;
    };
}

const ThemeContext = createContext<ThemeColors | null>(null)

interface ThemeProviderProps {
    iesId: string;
    children: ReactNode;
}

export function ThemeProvider({ iesId, children }: ThemeProviderProps) {
    const [theme, setTheme] = useState<ThemeColors | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchTheme() {
            if (!iesId) return;

            try {

                const { data, error } = await supabase
                    .from('ies_branding')
                    .select('theme_colors')
                    .eq('ies_id', iesId)
                    .single() as any;

                if (error) {
                    Logger.error('Erro ao buscar tema:', error);
                    setLoading(false);
                    return;
                }

                if (data?.theme_colors) {
                    const colors = data.theme_colors as unknown as ThemeColors;

                    setTheme(colors);
                    applyThemeToCSS(colors);
                }
            } catch (err) {
                Logger.error(err);
            } finally {
                setLoading(false);
            }
        }

        fetchTheme()
    }, [iesId])

    const applyThemeToCSS = (colors: ThemeColors) => {
        const root = document.documentElement

        if (colors.brand?.primary) root.style.setProperty('--brand-primary', colors.brand.primary)
        if (colors.brand?.secondary) root.style.setProperty('--brand-secondary', colors.brand.secondary)
        if (colors.brand?.accent) root.style.setProperty('--brand-accent', colors.brand.accent)

        if (colors.ui?.background) root.style.setProperty('--ui-bg', colors.ui.background)
        if (colors.ui?.surface) root.style.setProperty('--ui-surface', colors.ui.surface)
        if (colors.ui?.border) root.style.setProperty('--ui-border', colors.ui.border)

        if (colors.text?.main) root.style.setProperty('--text-main', colors.text.main)
        if (colors.text?.inverse) root.style.setProperty('--text-inverse', colors.text.inverse)
    }

    // Evita o "flash" inicial
    if (loading) return <div className="p-10">Carregando...</div>

    return (
        <ThemeContext.Provider value={theme}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}