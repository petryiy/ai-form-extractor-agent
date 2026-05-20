import { NextResponse, type NextRequest } from "next/server";

function isAuthorized(request: NextRequest) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    return true;
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Basic ")) {
    return false;
  }

  try {
    const decoded = atob(authorization.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex === -1) {
      return false;
    }

    const actualUsername = decoded.slice(0, separatorIndex);
    const actualPassword = decoded.slice(separatorIndex + 1);

    return actualUsername === username && actualPassword === password;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  if (isAuthorized(request)) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Requirement Inbox"'
    }
  });
}

export const config = {
  matcher: ["/admin/:path*"]
};
