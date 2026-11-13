// In-memory cookie jar standing in for next/headers cookies() in integration tests.
// signInAdmin() writes the Supabase session cookies here and assertAdmin() reads them back,
// exactly like a browser would between two requests.
export const cookieJar = new Map<string, string>();
