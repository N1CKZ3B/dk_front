// Configuración de la URL del backend
const BACKEND_URL =
    window.location.hostname === 'localhost'
        ? 'http://localhost:8080' // URL del backend en desarrollo
        : 'https://mi-backend-produccion.com'; // URL del backend en producción

// Variables globales
let username = ""; // Nombre del jugador
const gridCells = []; // Celdas del tablero
let playerPosition = -1; // Posición del jugador
let playerColor = ""; // Color del jugador
let socket; // WebSocket
let canMove = false; // Permitir movimientos solo después del conteo
let players = {}; // Objeto para rastrear jugadores
const obstacles = []; // Array de obstáculos
const readyPlayers = new Set(); // Jugadores listos
let ballPosition = 5; // Posición inicial de la pelota
let isBallOnBoard = true; // Estado de la pelota
let isBallMoving = false; // Indica si la pelota ya está en movimiento

// Crear la cuadrícula del juego
function createGrid() {
    const gridContainer = document.getElementById("grid");

    for (let i = 0; i < 110; i++) { // 11 columnas x 10 filas = 110 celdas
        const cell = document.createElement("div");
        cell.classList.add("cell");

        // Si es la columna 6 (índice 5), agregar como obstáculo
        if (i % 11 === 5) {
            cell.classList.add("obstacle");
            obstacles.push(i);
        }

        gridCells.push(cell);
        gridContainer.appendChild(cell);
    }
}

// Agregar jugador a la cuadrícula
function addPlayerToGrid() {
    const assignedPosition = Math.floor(Math.random() * gridCells.length);
    playerPosition = assignedPosition;
    playerColor = getRandomColor();

    players[username] = { position: playerPosition, color: playerColor };

    updateGrid();
}

// Función para asignar el nombre de usuario
function setUsername() {
    const nameInput = document.getElementById("username");
    username = nameInput.value.trim();

    // Validar si el nombre de usuario es válido
    if (!username) {
        alert("Por favor, ingresa un nombre de usuario válido.");
        return;
    }

    playerColor = getRandomColor();
    document.getElementById("usernameContainer").style.display = "none";
    document.getElementById("playerName").textContent = `Jugador: ${username}`;

    // Notificar al servidor el nuevo jugador
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: "newPlayer",
            username: username,
            position: playerPosition,
            color: playerColor,
        }));
    } else {
        console.error("WebSocket no está abierto. No se pudo registrar al jugador.");
    }
}

// Mover al jugador
function movePlayer(direction) {
    if (!canMove) return;

    let newPosition = playerPosition;

    switch (direction) {
        case 'ArrowUp':
            if (playerPosition >= 11) newPosition -= 11;
            break;
        case 'ArrowDown':
            if (playerPosition < 99) newPosition += 11;
            break;
        case 'ArrowLeft':
            if (playerPosition % 11 !== 0) newPosition -= 1;
            break;
        case 'ArrowRight':
            if (playerPosition % 11 !== 10) newPosition += 1;
            break;
        default:
            return;
    }

    if (!isObstacle(newPosition) && !isPositionOccupied(newPosition)) {
        playerPosition = newPosition;

        // Enviar la nueva posición al servidor
        socket.send(JSON.stringify({
            type: 'move',
            username: username,
            position: playerPosition,
        }));

        updateGrid(); // Actualizar la cuadrícula local
        if (!isBallMoving) {
            checkCollision(); // Verifica si el jugador colisiona con la pelota
        }
    }
}

// Actualizar la cuadrícula del juego
function updateGrid() {
    gridCells.forEach((cell) => {
        cell.innerHTML = ""; // Limpia la celda
    });

    // Dibuja jugadores
    Object.keys(players).forEach((playerUsername) => {
        const { position, color } = players[playerUsername];
        if (position >= 0 && position < gridCells.length) {
            const cell = gridCells[position];
            const playerDiv = document.createElement("div");
            playerDiv.className = "player";
            playerDiv.style.backgroundColor = color;
            cell.appendChild(playerDiv);
        }
    });

    // Dibuja la pelota
    if (isBallOnBoard && ballPosition >= 0 && ballPosition < gridCells.length) {
        const ballCell = gridCells[ballPosition];
        const ballDiv = document.createElement("div");
        ballDiv.className = "ball";
        ballDiv.style.backgroundImage = "url('./images/favicon.png')";
        ballDiv.style.backgroundSize = "cover";
        ballDiv.style.backgroundPosition = "center";
        ballCell.appendChild(ballDiv);
    }
}

// Inicializar WebSocket
function initializeWebSocket() {
    socket = new WebSocket(`ws://${BACKEND_URL.split('//')[1]}`); // Cambiar http:// a ws://

    socket.onopen = () => {
        console.log('WebSocket conectado.');
        username = localStorage.getItem('username');
        if (!username) {
            console.error("El nombre de usuario no está definido.");
            return;
        }
        // Enviar datos del jugador al conectarse
        socket.send(
            JSON.stringify({
                type: 'newPlayer',
                username,
                position: playerPosition,
                color: playerColor,
            })
        );
    };

    socket.onmessage = handleServerMessage;

    socket.onclose = (event) => {
        console.log(`WebSocket cerrado. Código: ${event.code}, Razón: ${event.reason}`);
    };
}

// Manejar mensajes del servidor
function handleServerMessage(event) {
    try {
        const data = JSON.parse(event.data);
        console.log("Mensaje recibido:", data);

        switch (data.type) {
            case 'updateGameState':
                players = data.players || {};
                ballPosition = data.ballPosition || null;
                updateGrid();
                break;

            default:
                console.warn("Tipo de mensaje desconocido:", data.type);
        }
    } catch (error) {
        console.error("Error procesando mensaje:", error);
    }
}

// Inicializar el juego
document.addEventListener("DOMContentLoaded", () => {
    createGrid();
    initializeWebSocket();
});
