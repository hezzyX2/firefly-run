# Custom Domain + Branding Pack

Use this to put your GitHub Pages site on **your own domain** and change the favicon/share image.

## 1) DNS setup
### Subdomain (easiest)
Point `play.yourdomain.com` to GitHub Pages with a **CNAME** record:
- **Host/Name:** play
- **Type:** CNAME
- **Target/Value:** YOUR-USERNAME.github.io.

### Root domain (yourdomain.com)
Add **A** records to these IPs:
- 185.199.108.153
- 185.199.109.153
- 185.199.110.153
- 185.199.111.153

## 2) Tell GitHub your domain
Repository **Settings → Pages → Custom domain**: enter your domain and Save.  
Enable **Enforce HTTPS** when available.

## 3) Add the CNAME file
Put the `CNAME` file in the **repo root**.  
Edit it to contain your domain, e.g. `yourdomain.com` or `play.yourdomain.com`.

## 4) Replace favicon + social image
Upload these to the repo root:
- `favicon.png`
- `favicon.svg`
- `og-image.png`

Add these tags in your `index.html` `<head>`:
```html
<link rel="icon" href="favicon.png" sizes="any">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<meta property="og:image" content="og-image.png">
<meta name="theme-color" content="#0a2e12">
```

## 5) Change the tab title
Edit `<title>…</title>` in `index.html` to your branding (e.g., `Ryan's Forest Dodge Game`).

That's it! DNS can take some time to propagate. Your game will be live on your domain when ready.
