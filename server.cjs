const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream');
const root = path.join(__dirname, 'public');
const media = path.join(root, 'motions');
const port = Number(process.env.PORT || 9540);
const host = process.env.HOST || '0.0.0.0';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mp4': 'video/mp4', '.webm': 'video/webm', '.m4v': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png' };
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/videos') {
      const entries = await fs.promises.readdir(media, { withFileTypes: true });
      const videos = entries.filter(e => e.isFile() && /\.(mp4|webm|m4v)$/i.test(e.name))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }))
        .map(e => ({ name: e.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '), url: '/motions/' + encodeURIComponent(e.name) }));
      return json(res, 200, videos);
    }
    const pathname = decodeURIComponent(url.pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) return json(res, 403, { error: 'Acesso negado' });
    const stat = await fs.promises.stat(file);
    if (!stat.isFile()) return json(res, 404, { error: 'Arquivo não encontrado' });
    let start = 0, end = stat.size - 1, status = 200;
    const headers = { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) { res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }); return res.end(); }
      if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }); return res.end();
      }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    }
    headers['Content-Length'] = Math.max(0, end - start + 1);
    res.writeHead(status, headers);
    if (req.method === 'HEAD' || !stat.size) return res.end();
    pipeline(fs.createReadStream(file, { start, end }), res, () => {});
  } catch (error) {
    if (!res.headersSent) json(res, ['ENOENT', 'ENOTDIR', 'URIError'].includes(error.code || error.name) ? 404 : 500, { error: 'Não foi possível carregar o recurso' });
    else res.destroy();
  }
});
server.listen(port, host, () => console.log(`Motion Player disponível em http://${host}:${port}`));
process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
