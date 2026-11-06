/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#0B0B0F',
                surface: '#16161E',
                surfaceBorder: '#262635',
                primary: '#E50914',
                primaryHover: '#FF2E4D',
                seat: {
                    standard: '#3A3A4A',
                    vip: '#F59E0B',
                    couple: '#EC4899',
                    selected: '#E50914',
                    locked: '#6366F1',
                    booked: '#1F1F28'
                },
                muted: '#9E9EA7'
            },
            fontFamily: {
                sans: ['Inter', 'Roboto', 'sans-serif'],
            }
        },
    },
    plugins: [],
}