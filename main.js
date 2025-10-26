
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let monkeyImg = new Image();
monkeyImg.src = "assets/nico_monkey.png";

let spiderImg = new Image();
spiderImg.src = "assets/enemy_spider.png";

let monkey = { x: 100, y: 300, width: 50, height: 50, vy: 0, grounded: true, ammo: 6 };
let keys = {};
let bullets = [];
let enemies = [{ x: 600, y: 300, width: 50, height: 50 }];

document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

function shoot() {
    if (monkey.ammo > 0) {
        bullets.push({ x: monkey.x + 40, y: monkey.y + 20, width: 10, height: 5 });
        monkey.ammo--;
    }
}

function update() {
    if (keys["w"] && monkey.grounded) {
        monkey.vy = -10;
        monkey.grounded = false;
    }
    if (keys["a"]) monkey.x -= 5;
    if (keys["d"]) monkey.x += 5;
    if (keys[" "]) shoot();

    monkey.vy += 0.5;
    monkey.y += monkey.vy;
    if (monkey.y >= 300) {
        monkey.y = 300;
        monkey.vy = 0;
        monkey.grounded = true;
    }

    bullets.forEach(b => b.x += 8);

    bullets = bullets.filter(b => b.x < canvas.width);

    enemies.forEach((e, ei) => {
        bullets.forEach((b, bi) => {
            if (b.x < e.x + e.width && b.x + b.width > e.x &&
                b.y < e.y + e.height && b.y + b.height > e.y) {
                enemies.splice(ei, 1);
                bullets.splice(bi, 1);
                monkey.ammo += 2;
            }
        });
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(monkeyImg, monkey.x, monkey.y, monkey.width, monkey.height);
    enemies.forEach(e => ctx.drawImage(spiderImg, e.x, e.y, e.width, e.height));
    bullets.forEach(b => {
        ctx.fillStyle = "green";
        ctx.fillRect(b.x, b.y, b.width, b.height);
    });

    ctx.fillStyle = "black";
    ctx.fillText("Ammo: " + monkey.ammo, 10, 20);
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
