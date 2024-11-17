import { defineConfig, Plugin } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const fullReloadAlways: Plugin = {
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
            '/data': 'http://localhost:8888',
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
