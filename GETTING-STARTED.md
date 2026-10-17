# Run FlipWise on your computer

No programming needed. You install one free program (Node.js), download FlipWise, and double-click a start file.
Everything — including the database — stays on your computer.

## 1. Install Node.js (once)

1. Go to **https://nodejs.org**.
2. Download the version marked **LTS** and install it with the default options.
   - Windows: run the `.msi` file, click *Next* until it finishes.
   - Mac: open the `.pkg` file and follow the steps.

## 2. Download FlipWise

1. Open **https://github.com/dt2fgdh7nv-dotcom/Flipwise** (sign in to GitHub if the repository is private).
2. Click the green **Code** button → **Download ZIP**.
3. Unzip it, e.g. onto your Desktop. You get a folder called something like `Flipwise-…`.

## 3. Start it

**Windows:** open the folder and double-click **`start-windows.bat`**.
If Windows shows *"Windows protected your PC"*, click **More info → Run anyway**.

**Mac:** open the folder, **right-click `start-mac.command` → Open → Open**
(the first time macOS asks because the file comes from the internet).
If that doesn't work: open the *Terminal* app, type `bash ` (with a space), drag `start-mac.command`
into the Terminal window and press Enter.

A black window opens and shows four steps. The **first start takes a few minutes**
(it downloads components); later starts take about a minute. Your browser then opens
**http://localhost:3000** by itself.

## 4. Sign in

| Email | Password | What you see |
|---|---|---|
| `demo@flipwise.fi` | `flipwise-demo-2026` | The flipper workspace with 3 demo projects |
| `client@flipwise.fi` | `flipwise-demo-2026` | What a client sees when you share a project |
| `admin@flipwise.fi` | `flipwise-demo-2026` | Platform admin: tax rates and the cost database |

You can also create your own account with **Create a workspace**.
Emails (sign-in links, invitations) are not really sent on your computer — you find them at
**http://localhost:3000/dev/mail**.

## Stopping and starting again

- **Stop:** close the black window.
- **Start again:** double-click the start file again. Your projects are kept (they are saved in the
  hidden `.data` folder inside the FlipWise folder).

## Getting a newer version

Download the ZIP again, unzip it to a new folder and start it from there. To keep your own data,
copy the `.data` folder from the old FlipWise folder into the new one before starting
(on a Mac press `Cmd + Shift + .` in Finder to see hidden folders; on Windows enable
*View → Show → Hidden items*).

## If something goes wrong

- **"Node.js is not installed"** — install it (step 1), then close and re-open the start file.
- **"Port 3000 is already in use"** — FlipWise is probably already running in another window; use that one or close it.
- Anything else: copy the text from the black window and send it to your developer.
