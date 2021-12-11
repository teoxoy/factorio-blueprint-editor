export async function onRequest({ request }) {
    const url = new URL(request.url)
    let apiUrl = url.searchParams.get('url')

    if (apiUrl == null) {
        return new Response()
    }

    // Rewrite request to point to API url. This also makes the request mutable
    // so we can add the correct Origin header to make the API server think
    // that this request isn't cross-site.
    const proxyRequest = new Request(apiUrl, request)
    proxyRequest.headers.set('Origin', new URL(apiUrl).origin)
    let response = await fetch(proxyRequest, { redirect: 'follow' })

    // Recreate the response so we can modify the headers
    response = new Response(response.body, response)

    // Set CORS headers
    response.headers.set('Access-Control-Allow-Origin', url.origin)

    // Append to/Add Vary header so browser will cache response correctly
    response.headers.append('Vary', 'Origin')

    return response
}
