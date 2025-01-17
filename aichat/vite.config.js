import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import dotenv from 'dotenv'

// 加载根目录的环境变量
dotenv.config({
  path: path.resolve(__dirname, '../.env')
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: process.env.FRONTEND_PORT || 3030
  },
  define: {
    // 优先使用 Docker 环境变量，如果不存在则使用 .env 文件中的值
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'http://localhost:3000')
  }
})
