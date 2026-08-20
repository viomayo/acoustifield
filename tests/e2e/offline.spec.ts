import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { SUPABASE_AUTH_STORAGE_KEY } from '../../lib/supabase/client'

const USER_ID = '00000000-0000-0000-0000-000000000001'
const SHELL_PATHS = new Set(['/', '/recapitulatif'])
const EXPECTED_SHELL_VERSION = readFileSync('.next/BUILD_ID', 'utf8').trim()

let offlineMode = false

test.describe.configure({ mode: 'serial' })

function token() {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: USER_ID, email: 'terrain@example.test', exp: Math.floor(Date.now() / 1000) + 3600, user_metadata: { full_name: 'Test Terrain' } })}.signature`
}

test.beforeEach(async ({ context }) => {
  const accessToken = token()
  const session = {
    access_token: accessToken,
    refresh_token: 'terrain-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: USER_ID,
      email: 'terrain@example.test',
      user_metadata: { full_name: 'Test Terrain' },
    },
  }
  await context.addInitScript(({ storageKey, session }) => {
    window.localStorage.setItem(storageKey, JSON.stringify(session))
  }, { storageKey: SUPABASE_AUTH_STORAGE_KEY, session })
  await context.route('**/auth/v1/user', async (route) => {
    if (offlineMode) {
      await route.abort('internetdisconnected')
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: USER_ID,
        email: 'terrain@example.test',
        user_metadata: { full_name: 'Test Terrain' },
      }),
    })
  })
  await context.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204 }))
  await context.route('**/rest/v1/fiches**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }))
  await context.route('**/rest/v1/profiles**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }))
  await context.route('**/rest/v1/rpc/current_user_is_supervisor', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: 'false',
  }))
})

test.afterEach(async ({ context, page }) => {
  offlineMode = false
  await context.setOffline(false).catch(() => undefined)
  await page.waitForFunction(() => navigator.onLine).catch(() => undefined)
})

async function waitForOfflineReadiness(page: Page) {
  await expect(page.getByText('En ligne — Prêt hors ligne')).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => page.evaluate(async (expectedVersion) => {
    const registration = await navigator.serviceWorker.ready
    const worker = navigator.serviceWorker.controller ?? registration.active
    if (!worker) return null
    return new Promise((resolve) => {
      const channel = new MessageChannel()
      const timeout = window.setTimeout(() => resolve(null), 1_000)
      channel.port1.onmessage = (event) => {
        window.clearTimeout(timeout)
        resolve(event.data)
      }
      worker.postMessage({ type: 'OFFLINE_STATUS', expectedVersion }, [channel.port2])
    })
  }, EXPECTED_SHELL_VERSION)).toMatchObject({
    ready: true,
    routes: { '/': true, '/recapitulatif': true },
  })
}

async function openOnlyHomeWithoutShellPrefetch(page: Page, context: BrowserContext) {
  const shellNavigations: string[] = []
  context.on('request', (request) => {
    const pathname = new URL(request.url()).pathname
    if (request.isNavigationRequest() && SHELL_PATHS.has(pathname)) shellNavigations.push(pathname)
  })
  await context.route('**/*', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (SHELL_PATHS.has(pathname) && request.headers()['next-router-prefetch'] === '1') {
      await route.abort()
      return
    }
    await route.fallback()
  })

  await page.goto('/')
  await expect(page.getByText('Test Terrain')).toBeVisible()
  await waitForOfflineReadiness(page)
  expect(shellNavigations).toEqual(['/'])
}

async function goOffline(page: Page, context: BrowserContext) {
  offlineMode = true
  await context.setOffline(true)
  await expect(page.getByText('Hors ligne — application prête')).toBeVisible()
}

async function readLocalData(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('acoustifield')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const readAll = <T>(storeName: string) => new Promise<T[]>((resolve, reject) => {
      const request = db.transaction(storeName).objectStore(storeName).getAll()
      request.onsuccess = () => resolve(request.result as T[])
      request.onerror = () => reject(request.error)
    })
    const readProfile = () => new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
      const request = db.transaction('offline_profile').objectStore('offline_profile').get('active')
      request.onsuccess = () => resolve(request.result as Record<string, unknown> | undefined)
      request.onerror = () => reject(request.error)
    })
    const [fiches, photos, profile] = await Promise.all([
      readAll<Record<string, unknown>>('fiches'),
      readAll<Record<string, unknown>>('photos'),
      readProfile(),
    ])
    db.close()
    return { fiches, photos, profile }
  })
}

async function createFicheThroughUi(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Fiche de pose' })).toBeVisible()
  await page.getByRole('button', { name: 'SM4BAT' }).click()
  await page.getByLabel('N° du boîtier').fill('SM4BAT-0001')
  await page.getByLabel('Projet').fill('Suivi des chiroptères')
  await page.getByLabel('Jour et heure de pose *').fill('2026-08-15T20:00')
  await page.getByRole('button', { name: 'Ouvert', exact: true }).click()
  await page.getByLabel("Description de l'habitat principal (< 10 m) *").selectOption({ label: 'Forêt feuillue' })
  await page.getByLabel('Nom du site').fill('Étang de la Hulotte')
  await page.getByLabel('Commentaires').fill('Fiche créée entièrement hors ligne')
  await page.getByRole('button', { name: /enregistrer une nouvelle fiche/i }).click()
  await expect(page.getByText('Fiche enregistrée en local')).toBeVisible()
}

test('valide le parcours fiche de pose intégré de la readiness au logout offline', async ({ page, context }) => {
  await openOnlyHomeWithoutShellPrefetch(page, context)

  const cachedSupabaseUrls = await page.evaluate(async () => {
    const urls: string[] = []
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) {
        if (new URL(request.url).hostname.includes('supabase')) urls.push(request.url)
      }
    }
    return urls
  })
  expect(cachedSupabaseUrls).toEqual([])

  await goOffline(page, context)
  await createFicheThroughUi(page)

  const beforeReload = await readLocalData(page)
  expect(beforeReload.fiches).toHaveLength(1)
  expect(beforeReload.fiches[0]).toMatchObject({
    ownerId: USER_ID,
    dirty: true,
    appareilType: 'SM4BAT',
    boitierNum: 'SM4BAT-0001',
    siteNom: 'Étang de la Hulotte',
  })

  const formUrl = page.url()
  await page.reload()
  await expect(page).toHaveURL(formUrl)
  await expect(page.getByRole('heading', { name: 'Fiche de pose' })).toBeVisible()

  await page.getByRole('link', { name: 'Récapitulatif' }).first().click()
  await expect(page).toHaveURL(/\/recapitulatif$/)
  await expect(page.getByText('Étang de la Hulotte')).toBeVisible()
  await expect(page.getByText('en attente', { exact: true })).toBeVisible()

  const resumedPage = await context.newPage()
  await resumedPage.goto('/recapitulatif')
  await expect(resumedPage.getByText('Étang de la Hulotte')).toBeVisible()
  await resumedPage.close()

  await page.goto('/')
  await page.reload()
  await expect(page.getByText('Mode hors ligne — travail local disponible')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sync' })).toBeDisabled()
  expect((await readLocalData(page)).fiches[0]).toMatchObject({ dirty: true })

  await context.setOffline(false)
  offlineMode = false
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByText('En ligne — Prêt hors ligne')).toBeVisible()
  await expect(page.getByText(/travail local disponible/)).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Sync' })).toBeEnabled()
  expect((await readLocalData(page)).fiches[0]).toMatchObject({ dirty: true, syncedAt: null })

  await goOffline(page, context)
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await expect(page.getByText('Application verrouillée.')).toBeVisible()
  await expect.poll(async () => (await readLocalData(page)).profile?.offlineEnabled).toBe(false)
  await page.goto('/')
  await expect(page.getByText('Application verrouillée.')).toBeVisible()

  const local = await readLocalData(page)
  expect(local.fiches).toHaveLength(1)
  expect(local.photos).toHaveLength(0)
  expect(local.profile).toMatchObject({ ownerId: USER_ID, offlineEnabled: false })
})
