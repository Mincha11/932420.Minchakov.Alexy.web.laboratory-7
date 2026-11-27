
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = 4000;

// Разрешаем серверу принимать JSON
app.use(express.json());

// Подключаем папку со страницами
app.use(express.static(path.join(__dirname, "public")));

// Подключаем базу данных
const db = new sqlite3.Database(
    path.join(__dirname, "movies.db"),
    (error) => {
        if (error) {
            console.error("Ошибка подключения к БД:", error.message);
        } else {
            console.log("Подключение к SQLite выполнено");
        }
    }
);

// Создаём таблицу фильмов
db.run(`
    CREATE TABLE IF NOT EXISTS movies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        genre TEXT NOT NULL,
        rating REAL NOT NULL,
        release_year INTEGER NOT NULL
    )
`);

// Проверка данных фильма
function validateMovie(movie) {
    const { title, genre, rating, release_year } = movie;

    if (
        typeof title !== "string" ||
        title.trim() === "" ||
        typeof genre !== "string" ||
        genre.trim() === ""
    ) {
        return "Название и жанр должны быть заполнены";
    }

    if (
        rating === undefined ||
        rating === null ||
        rating === "" ||
        !Number.isFinite(Number(rating)) ||
        Number(rating) < 0 ||
        Number(rating) > 10
    ) {
        return "Рейтинг должен быть числом от 0 до 10";
    }

    if (
        release_year === undefined ||
        release_year === null ||
        release_year === "" ||
        !Number.isInteger(Number(release_year))
    ) {
        return "Год выпуска должен быть целым числом";
    }

    return null;
}

// GET /api/movies
// Получение фильмов с фильтрацией и сортировкой
app.get("/api/movies", (req, res) => {
    const { genre, minRating } = req.query;

    let sql = "SELECT * FROM movies WHERE 1=1";
    const params = [];

    // Фильтрация по жанру
    if (genre) {
        sql += " AND LOWER(genre) = LOWER(?)";
        params.push(genre);
    }

    // Фильтрация по минимальному рейтингу
    if (minRating !== undefined) {
        const rating = Number(minRating);

        if (
            minRating.trim() === "" ||
            !Number.isFinite(rating) ||
            rating < 0 ||
            rating > 10
        ) {
            return res.status(400).json({
                error: "minRating должен быть числом от 0 до 10"
            });
        }

        sql += " AND rating >= ?";
        params.push(rating);
    }

    // Сортировка и вывод максимум 10 фильмов
    sql += " ORDER BY rating DESC LIMIT 10";

    db.all(sql, params, (error, rows) => {
        if (error) {
            return res.status(500).json({
                error: "Ошибка получения фильмов"
            });
        }

        res.json(rows);
    });
});

// POST /api/movies
// Добавление нового фильма
app.post("/api/movies", (req, res) => {
    const errorMessage = validateMovie(req.body);

    if (errorMessage) {
        return res.status(400).json({
            error: errorMessage
        });
    }

    const { title, genre, rating, release_year } = req.body;

    const sql = `
        INSERT INTO movies (title, genre, rating, release_year)
        VALUES (?, ?, ?, ?)
    `;

    db.run(
        sql,
        [
            title.trim(),
            genre.trim(),
            Number(rating),
            Number(release_year)
        ],
        function (error) {
            if (error) {
                return res.status(500).json({
                    error: "Ошибка добавления фильма"
                });
            }

            res.status(201).json({
                message: "Фильм успешно добавлен",
                id: this.lastID,
                title: title.trim(),
                genre: genre.trim(),
                rating: Number(rating),
                release_year: Number(release_year)
            });
        }
    );
});

// PUT /api/movies/:id
// Обновление фильма
app.put("/api/movies/:id", (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "Некорректный ID фильма"
        });
    }

    const errorMessage = validateMovie(req.body);

    if (errorMessage) {
        return res.status(400).json({
            error: errorMessage
        });
    }

    const { title, genre, rating, release_year } = req.body;

    const sql = `
        UPDATE movies
        SET title = ?, genre = ?, rating = ?, release_year = ?
        WHERE id = ?
    `;

    db.run(
        sql,
        [
            title.trim(),
            genre.trim(),
            Number(rating),
            Number(release_year),
            id
        ],
        function (error) {
            if (error) {
                return res.status(500).json({
                    error: "Ошибка обновления фильма"
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    error: "Фильм не найден"
                });
            }

            res.json({
                message: "Фильм успешно обновлён"
            });
        }
    );
});

// DELETE /api/movies/:id
// Удаление фильма
app.delete("/api/movies/:id", (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "Некорректный ID фильма"
        });
    }

    db.run(
        "DELETE FROM movies WHERE id = ?",
        [id],
        function (error) {
            if (error) {
                return res.status(500).json({
                    error: "Ошибка удаления фильма"
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    error: "Фильм не найден"
                });
            }

            res.json({
                message: "Фильм успешно удалён"
            });
        }
    );
});

// Запускаем сервер только после создания таблицы
db.get(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='movies'",
    (error, row) => {
        if (error || !row) {
            console.error("Не удалось проверить таблицу movies");
            return;
        }

        app.listen(PORT, () => {
            console.log(`Сервер запущен: http://localhost:${PORT}`);
        });
    }
);
