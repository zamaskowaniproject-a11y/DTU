const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const app = express();

// 🔥 NAJWAŻNIEJSZE — PORT DLA RENDER
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const CASES_FILE = path.join(DATA_DIR, "cases.json");
const NOTES_FILE = path.join(DATA_DIR, "notes.json");

// 🔥 UPEWNIJ SIĘ, ŻE FOLDER DATA ISTNIEJE
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// 🔥 TWORZENIE PLIKÓW JEŚLI NIE ISTNIEJĄ
function initFile(filePath, defaultData) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), "utf8");
    }
}

initFile(USERS_FILE, [
    {
        email: "Comm.dtu.223",
        password: "DTUX0029348",
        name: "DTU Commander",
        rank: "Commander",
        role: "admin",
        canAddReports: true,
        avatarUrl: ""
    }
]);

initFile(CASES_FILE, []);
initFile(NOTES_FILE, []);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// 🔥 UPLOADY
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + "-" + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype !== "application/pdf") {
            return cb(new Error("Tylko pliki PDF są dozwolone"));
        }
        cb(null, true);
    }
});

// 🔥 FUNKCJE JSON
function readJson(filePath) {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// 🔥 LOGIN
app.post("/api/login", (req, res) => {
    const { email, password } = req.body;

    const users = readJson(USERS_FILE);
    console.log("USERS:", users);

    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
        return res.status(401).json({ error: "Nieprawidłowy email lub hasło" });
    }

    return res.json({
        email: user.email,
        name: user.name,
        rank: user.rank,
        role: user.role,
        canAddReports: user.canAddReports !== false,
        avatarUrl: user.avatarUrl || ""
    });
});

// 🔥 ADMIN – dodawanie użytkowników
app.post("/api/users", (req, res) => {
    const { adminRole, email, password, name, rank } = req.body;

    if (adminRole !== "admin") {
        return res.status(403).json({ error: "Brak uprawnień do dodawania użytkowników" });
    }

    const users = readJson(USERS_FILE);

    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: "Użytkownik o takim emailu już istnieje" });
    }

    const newUser = {
        email,
        password,
        name,
        rank,
        role: "detektyw",
        canAddReports: true,
        avatarUrl: ""
    };

    users.push(newUser);
    writeJson(USERS_FILE, users);

    return res.json({ success: true, user: newUser });
});

// 🔥 ADMIN – lista użytkowników
app.get("/api/users", (req, res) => {
    const users = readJson(USERS_FILE);
    return res.json(users);
});

// 🔥 ADMIN – usuwanie użytkownika
app.delete("/api/users/:email", (req, res) => {
    const email = req.params.email;
    const users = readJson(USERS_FILE);
    const filtered = users.filter(u => u.email !== email);

    if (filtered.length === users.length) {
        return res.status(404).json({ error: "Użytkownik nie istnieje" });
    }

    writeJson(USERS_FILE, filtered);
    return res.json({ success: true });
});

// 🔥 ADMIN – blokowanie raportów
app.put("/api/users/:email/reports", (req, res) => {
    const email = req.params.email;
    const { canAddReports } = req.body;

    const users = readJson(USERS_FILE);
    const user = users.find(u => u.email === email);

    if (!user) {
        return res.status(404).json({ error: "Użytkownik nie istnieje" });
    }

    user.canAddReports = !!canAddReports;
    writeJson(USERS_FILE, users);

    return res.json({ success: true, user });
});

// 🔥 ADMIN – edycja konta
app.put("/api/users/:email", (req, res) => {
    const email = req.params.email;
    const { name, rank, avatarUrl } = req.body;

    const users = readJson(USERS_FILE);
    const user = users.find(u => u.email === email);

    if (!user) {
        return res.status(404).json({ error: "Użytkownik nie istnieje" });
    }

    if (typeof name === "string") user.name = name;
    if (typeof rank === "string") user.rank = rank;
    if (typeof avatarUrl === "string") user.avatarUrl = avatarUrl;

    writeJson(USERS_FILE, users);

    return res.json({ success: true, user });
});

// 🔥 SPRAWY – pobieranie
app.get("/api/cases", (req, res) => {
    const cases = readJson(CASES_FILE);
    return res.json(cases);
});

// 🔥 SPRAWY – dodawanie
app.post("/api/cases", (req, res) => {
    const { title, description, createdBy } = req.body;

    if (!title || !description || !createdBy) {
        return res.status(400).json({ error: "Brak wymaganych pól" });
    }

    const cases = readJson(CASES_FILE);

    const newCase = {
        id: Date.now(),
        title,
        description,
        createdBy,
        documents: []
    };

    cases.push(newCase);
    writeJson(CASES_FILE, cases);

    return res.json({ success: true, case: newCase });
});

// 🔥 SPRAWY – edycja
app.put("/api/cases/:id", (req, res) => {
    const caseId = parseInt(req.params.id, 10);
    const { title, description } = req.body;

    const cases = readJson(CASES_FILE);
    const foundCase = cases.find(c => c.id === caseId);

    if (!foundCase) {
        return res.status(404).json({ error: "Sprawa nie istnieje" });
    }

    if (title) foundCase.title = title;
    if (description) foundCase.description = description;

    writeJson(CASES_FILE, cases);
    return res.json({ success: true, case: foundCase });
});

// 🔥 SPRAWY – usuwanie
app.delete("/api/cases/:id", (req, res) => {
    const caseId = parseInt(req.params.id, 10);

    const cases = readJson(CASES_FILE);
    const filtered = cases.filter(c => c.id !== caseId);

    if (filtered.length === cases.length) {
        return res.status(404).json({ error: "Sprawa nie istnieje" });
    }

    writeJson(CASES_FILE, filtered);
    return res.json({ success: true });
});

// 🔥 DOKUMENTY – dodawanie PDF
app.post("/api/cases/:id/documents", upload.single("pdf"), (req, res) => {
    const caseId = parseInt(req.params.id, 10);
    const { uploadedBy } = req.body;

    if (!req.file) {
        return res.status(400).json({ error: "Brak pliku PDF" });
    }

    const users = readJson(USERS_FILE);
    const user = users.find(u => u.email === uploadedBy);

    if (!user) {
        return res.status(403).json({ error: "Nieznany użytkownik" });
    }

    if (user.canAddReports === false) {
        return res.status(403).json({ error: "Użytkownik ma zablokowane dodawanie raportów" });
    }

    const cases = readJson(CASES_FILE);
    const foundCase = cases.find(c => c.id === caseId);

    if (!foundCase) {
        return res.status(404).json({ error: "Sprawa nie istnieje" });
    }

    const doc = {
        id: Date.now(),
        filename: req.file.filename,
        originalName: req.file.originalname,
        uploadedBy,
        uploadedAt: new Date().toISOString()
    };

    foundCase.documents.push(doc);
    writeJson(CASES_FILE, cases);

    return res.json({ success: true, document: doc });
});

// 🔥 DOKUMENTY – pobieranie PDF
app.get("/api/documents/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Plik nie istnieje" });
    }

    res.sendFile(filePath);
});

// 🔥 NOTATKI – pobieranie
app.get("/api/notes", (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ error: "Brak emaila użytkownika" });
    }

    const notes = readJson(NOTES_FILE);
    const userNotes = notes.filter(n => n.email === email);

    return res.json(userNotes);
});

// 🔥 NOTATKI – dodawanie
app.post("/api/notes", (req, res) => {
    const { email, content } = req.body;

    if (!email || !content) {
        return res.status(400).json({ error: "Brak wymaganych pól" });
    }

    const notes = readJson(NOTES_FILE);

    const newNote = {
        id: Date.now(),
        email,
        content,
        createdAt: new Date().toISOString()
    };

    notes.push(newNote);
    writeJson(NOTES_FILE, notes);

    return res.json({ success: true, note: newNote });
});

// 🔥 NOTATKI – edycja
app.put("/api/notes/:id", (req, res) => {
    const noteId = parseInt(req.params.id, 10);
    const { content } = req.body;

    const notes = readJson(NOTES_FILE);
    const note = notes.find(n => n.id === noteId);

    if (!note) {
        return res.status(404).json({ error: "Notatka nie istnieje" });
    }

    if (content) note.content = content;
    writeJson(NOTES_FILE, notes);

    return res.json({ success: true, note });
});

// 🔥 NOTATKI – usuwanie
app.delete("/api/notes/:id", (req, res) => {
    const noteId = parseInt(req.params.id, 10);

    const notes = readJson(NOTES_FILE);
    const filtered = notes.filter(n => n.id !== noteId);

    if (filtered.length === notes.length) {
        return res.status(404).json({ error: "Notatka nie istnieje" });
    }

    writeJson(NOTES_FILE, filtered);
    return res.json({ success: true });
});

// 🔥 START SERWERA
app.listen(PORT, () => {
    console.log(`DTU backend działa na porcie ${PORT}`);
});
