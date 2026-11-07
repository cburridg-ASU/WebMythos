# Mythos

Mythos is a small, static browser game prototype. It uses original placeholder legends and a tactical board-game loop built around movement and six-sided dice duels. No build step, backend, or package install is required.

## Play locally

Open `index.html` in a browser, or serve this folder with any static file server.

## Rules in this prototype

- Two players take alternating turns. Select one of your legends, then choose a highlighted tile.
- Legends move orthogonally up to their movement value. They cannot pass through other legends.
- Moving onto an opposing legend starts a duel. Each legend rolls its own six-sided die; higher total wins, and the defender wins ties.
- The losing legend is removed from the board. Bryn gets +1 while defending; Vesper's 6 counts as 7.
- Reach the opposing gate or remove all opposing legends to win.
- Use the circular-arrow button to restart the match.

## Publish with GitHub Pages

1. Push this repository to GitHub.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select the branch containing this page and the `/ (root)` folder, then save.
4. GitHub Pages will show the published URL in the Pages settings.