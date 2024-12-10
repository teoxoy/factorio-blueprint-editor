import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const fullReloadAlways = {
    name: 'full-reload',
    handleHotUpdate({ server }) {
        server.ws.send({ type: 'full-reload' })
        return []
    },
}

export default defineConfig(({ command }) => ({
    build: { sourcemap: true },
    preview: { port: 8080 },
    server: {
        port: 8080,
        proxy: {
            '/data': {
                target: 'http://127.0.0.1:8081',
                rewrite: path => path.replace(/^\/data/, ''),
            },
            '/corsproxy': {
                target: 'https://fbe.teoxoy.com',
                changeOrigin: true,
            },
        },
    },
    plugins: [
        command === 'build'
            ? viteStaticCopy({
                  targets: [
                      {
                          src: '../exporter/data/output',
                          dest: 'data',
                      },
                  ],
              })
            : fullReloadAlways,
    ],
}))
