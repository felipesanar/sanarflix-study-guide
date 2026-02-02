
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		screens: {
			'xs': '375px',
			'sm': '640px',
			'md': '768px',
			'lg': '1024px',
			'xl': '1280px',
			'2xl': '1536px',
		},
		extend: {
			fontFamily: {
				'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
				'display': ['Inter', 'system-ui', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					dark: 'hsl(var(--primary-dark))',
					light: 'hsl(var(--primary-light))',
					lighter: 'hsl(var(--primary-lighter))',
					lightest: 'hsl(var(--primary-lightest))',
					50: 'hsl(0 65% 98%)',
					100: 'hsl(0 65% 92%)',
					200: 'hsl(0 65% 85%)',
					300: 'hsl(0 65% 75%)',
					400: 'hsl(0 65% 55%)',
					500: 'hsl(0 65% 35%)',
					600: 'hsl(0 65% 25%)',
					700: 'hsl(0 65% 20%)',
					800: 'hsl(0 65% 15%)',
					900: 'hsl(0 65% 10%)',
				},
				// USCS Brand Colors
				uscs: {
					blue: 'hsl(214 76% 38%)',
					'blue-dark': 'hsl(214 76% 28%)',
					'blue-light': 'hsl(214 100% 85%)',
					orange: 'hsl(24 100% 57%)',
					'orange-light': 'hsl(24 100% 85%)',
					wine: 'hsl(0 65% 35%)',
					'wine-light': 'hsl(0 65% 85%)',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				neutral: {
					50: 'hsl(220 14% 100%)',
					100: 'hsl(220 14% 97%)',
					200: 'hsl(220 14% 95%)',
					300: 'hsl(220 14% 91%)',
					400: 'hsl(220 9% 66%)',
					500: 'hsl(220 9% 46%)',
					600: 'hsl(220 13% 37%)',
					700: 'hsl(220 13% 26%)',
					800: 'hsl(220 13% 16%)',
					900: 'hsl(220 13% 9%)',
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0',
						opacity: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)',
						opacity: '1'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)',
						opacity: '1'
					},
					to: {
						height: '0',
						opacity: '0'
					}
				},
				'drawer-slide-down': {
					'0%': {
						height: '0',
						opacity: '0',
						transform: 'translateY(-10px)'
					},
					'100%': {
						height: 'var(--radix-collapsible-content-height)',
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'drawer-slide-up': {
					'0%': {
						height: 'var(--radix-collapsible-content-height)',
						opacity: '1',
						transform: 'translateY(0)'
					},
					'100%': {
						height: '0',
						opacity: '0',
						transform: 'translateY(-10px)'
					}
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(10px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'slide-in-left': {
					'0%': { transform: 'translateX(-30px)', opacity: '0' },
					'100%': { transform: 'translateX(0)', opacity: '1' }
				},
				'slide-in-right': {
					'0%': { transform: 'translateX(30px)', opacity: '0' },
					'100%': { transform: 'translateX(0)', opacity: '1' }
				},
				'scale-in': {
					'0%': { transform: 'scale(0.95)', opacity: '0' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				'pulse-primary': {
					'0%, 100%': { boxShadow: '0 0 0 0 hsl(0 83% 38% / 0.4)' },
					'50%': { boxShadow: '0 0 0 8px hsl(0 83% 38% / 0)' }
				},
				'shimmer': {
					'0%': { backgroundPosition: '-200% 0' },
					'100%': { backgroundPosition: '200% 0' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.3s ease-out',
				'accordion-up': 'accordion-up 0.3s ease-out',
				'drawer-slide-down': 'drawer-slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
				'drawer-slide-up': 'drawer-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
				'fade-in': 'fade-in 0.4s ease-out',
				'slide-in-left': 'slide-in-left 0.5s ease-out',
				'slide-in-right': 'slide-in-right 0.5s ease-out',
				'scale-in': 'scale-in 0.3s ease-out',
				'pulse-primary': 'pulse-primary 2s infinite',
				'shimmer': 'shimmer 2s linear infinite'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
