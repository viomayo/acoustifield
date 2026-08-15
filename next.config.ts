import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const TERRAIN_SHELL_ROUTES = ['/', '/recapitulatif'] as const

function filesRecursively(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name)
      if (entry.isDirectory()) return filesRecursively(absolutePath)
      return entry.name.includes('.test.') ? [] : [absolutePath]
    })
    .sort()
}

function createShellVersion(): string {
  const hash = createHash('sha256')
  const files = [
    ...filesRecursively(path.join(process.cwd(), 'app')),
    ...filesRecursively(path.join(process.cwd(), 'lib')),
    path.join(process.cwd(), 'proxy.ts'),
    path.join(process.cwd(), 'package.json'),
    path.join(process.cwd(), 'package-lock.json'),
  ]

  for (const file of files) {
    hash.update(path.relative(process.cwd(), file))
    hash.update(readFileSync(file))
  }
  return hash.digest('hex').slice(0, 20)
}

const shellVersion = createShellVersion()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

const swCsp = [
  "default-src 'self'",
  "script-src 'self'",
  `connect-src 'self'${supabaseUrl ? ` ${supabaseUrl}` : ''}`,
].join('; ')

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  additionalPrecacheEntries: TERRAIN_SHELL_ROUTES.map((url) => ({
    url,
    revision: shellVersion,
  })),
})

const nextConfig: NextConfig = {
  generateBuildId: async () => shellVersion,
  env: {
    NEXT_PUBLIC_OFFLINE_SHELL_VERSION: shellVersion,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: swCsp },
        ],
      },
    ]
  },
}

export default withSerwist(nextConfig)
