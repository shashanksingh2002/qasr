import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function middleware(req: Request) {
  console.log("Request", req)
  const session = await getServerSession(authOptions);
  const url = new URL(req.url);

  if (!session && url.pathname.startsWith("/signin")) {
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
