import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'MTQS',
  description: 'MCP Tool Quality Specification',
  base: '/voke/',
  themeConfig: {
    nav: [
      { text: 'Spec', link: '/spec/' },
      { text: 'GitHub', link: 'https://github.com/voke-sh/voke' },
    ],
    sidebar: {
      '/spec/': [
        { text: 'Versions', link: '/spec/' },
        {
          text: 'v0.1',
          items: [
            { text: 'MTQS Specification', link: '/spec/v0.1/MTQS-v0.1' },
            { text: 'Scope', link: '/spec/v0.1/SCOPE' },
          ]
        }
      ]
    }
  }
})
