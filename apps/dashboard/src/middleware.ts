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

// 常数时间比较：按位累积差异，避免凭据比较泄漏计时信息。
// 长度差异直接判不等。
function timingSafeEquals(left: string, right: string) {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  if (leftBytes.length !== rightBytes.length) return false

  let diff = 0
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index]
  }
  return diff === 0
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
  const userMatches = timingSafeEquals(credentials?.user ?? "", expectedUser)
  const passwordMatches = timingSafeEquals(
    credentials?.password ?? "",
    expectedPassword,
  )
  if (userMatches && passwordMatches) {
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
