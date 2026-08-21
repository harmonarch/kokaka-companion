import { NextResponse, type NextRequest } from "next/server"

const authenticationHeaders = {
  "cache-control": "no-store",
  "www-authenticate": 'Basic realm="Kokaka Monitoring", charset="UTF-8"',
}

function credentialsFrom(request: NextRequest) {
  const authorization = request.headers.get("authorization")
  if (!authorization?.startsWith("Basic ")) return null

  try {
    const decoded = atob(authorization.slice("Basic ".length))
    const separator = decoded.indexOf(":")
    if (separator < 0) return null
    return {
      user: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    }
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const expectedUser = process.env.DASHBOARD_ACCESS_USER
  const expectedPassword = process.env.DASHBOARD_ACCESS_PASSWORD
  if (!expectedUser || !expectedPassword) {
    return new NextResponse("Dashboard access is not configured", {
      status: 503,
      headers: { "cache-control": "no-store" },
    })
  }

  const credentials = credentialsFrom(request)
  if (
    credentials?.user === expectedUser &&
    credentials.password === expectedPassword
  ) {
    return NextResponse.next()
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: authenticationHeaders,
  })
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
