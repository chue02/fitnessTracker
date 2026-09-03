// Thin fetch wrapper around the Django REST API. Relative URLs work because
// the Vite dev server proxies /api to http://localhost:8000.

async function request(method, path, body) {
  const opts = { method, headers: {} }
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(`/api${path}`, opts)
  if (!res.ok) {
    let detail
    try {
      detail = await res.json()
    } catch {
      detail = await res.text()
    }
    const err = new Error(`API ${method} ${path} failed (${res.status})`)
    err.status = res.status
    err.detail = detail
    throw err
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
}
