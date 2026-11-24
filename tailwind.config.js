/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./views/**/*.ejs', './server.js'],
  theme: {
    extend: {
      colors: {
        krem: '#f3eee1',
        kertas: '#fffdf6',
        tinta: '#111111',
        lime: '#c6f26b',
        kuning: '#ffd84d',
        oranye: '#ff7a45'
      },
      boxShadow: {
        keras: '5px 5px 0 #111111'
      },
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'monospace']
      }
    }
  },
  plugins: []
};
