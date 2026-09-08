import { defineConfig } from '@apps-in-toss/web-framework/config'

export default defineConfig({
  appName: 'replaypick',
  brand: {
    primaryColor: '#3B70F5',
  },
  permissions: [
    { name: 'clipboard', access: 'read' },
    { name: 'clipboard', access: 'write' },
  ],
  webBundleDir: 'dist',
})
