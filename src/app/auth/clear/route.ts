import { NextResponse } from "next/server";

export async function GET() {
  const response = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:2050"));

  // Clear all Supabase auth cookies
  const cookieOptions = {
    path: "/",
    expires: new Date(0),
  };

  response.cookies.set("sb-access-token", "", cookieOptions);
  response.cookies.set("sb-refresh-token", "", cookieOptions);

  // Clear any cookies that start with sb-
  const cookieNames = [
    "sb-access-token",
    "sb-refresh-token",
    "supabase-auth-token",
    "sb-localhost-auth-token",
    "sb-wbuqcxpxfunuubxffzih-auth-token",
    "sb-wbuqcxpxfunuubxffzih-auth-token.0",
    "sb-wbuqcxpxfunuubxffzih-auth-token.1",
  ];

  cookieNames.forEach(name => {
    response.cookies.set(name, "", cookieOptions);
  });

  return response;
}
