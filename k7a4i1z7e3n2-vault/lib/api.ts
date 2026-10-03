export async function apiPost(
    path: string,
    body: Record<string, unknown> = {}
) {
    const PROD = process.env.NEXT_PUBLIC_PROD_LINK || "";
    const API_KEY = process.env.NEXT_PUBLIC_SERVER_KEY || "";
    const base = PROD.replace(/\/$/, "");
    const url = `${base}/otp${path}`;

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
    }

    return res.json();
}
