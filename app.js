import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ১. এখানে আপনার Firebase Config বসানো হলো
const firebaseConfig = {
    apiKey: "AIzaSyDkwówaAQUF7Dauhnapl3dZ1ebekSQsXA4",
    authDomain: "my-library-d68b9.firebaseapp.com",
    projectId: "my-library-d68b9",
    storageBucket: "my-library-d68b9.firebasestorage.app",
    messagingSenderId: "1074260011498",
    appId: "1:1074260011498:web:f2698572b95a7f4fc1aa93"
};

// ২. এখানে আপনার অ্যাডমিন ইমেইল দিন (YOUR_ADMIN_EMAIL-এর জায়গায় আপনার আসল জিমেইল লিখবেন)
const ADMIN_EMAIL = "modegames000@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let isLoginMode = true;
let allBooks = [];
let isAdmin = false;

// PDF.js Worker Setup
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let pdfDoc = null, pageNum = 1, pageRendering = false, pageNumPending = null;

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        
        // Check Admin Access
        if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            isAdmin = true;
            document.getElementById('admin-panel-btn').style.display = 'inline-block';
        } else {
            isAdmin = false;
            document.getElementById('admin-panel-btn').style.display = 'none';
        }
        loadBooks();
    } else {
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }
});

// Toggle Login / Signup
window.toggleAuthMode = () => {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'ই-লাইব্রেরিতে লগইন করুন' : 'নতুন অ্যাকাউন্ট খুলুন';
    document.getElementById('auth-btn').innerText = isLoginMode ? 'লগইন করুন' : 'সাইন আপ করুন';
    document.getElementById('auth-toggle').innerText = isLoginMode ? 'অ্যাকাউন্ট নেই? নতুন অ্যাকাউন্ট খুলুন' : 'আগে থেকেই অ্যাকাউন্ট আছে? লগইন করুন';
    document.getElementById('auth-error').innerText = '';
};

// Handle Login / Signup
window.handleAuth = async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorEl = document.getElementById('auth-error');
    errorEl.innerText = '';

    try {
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            await createUserWithEmailAndPassword(auth, email, password);
        }
    } catch (error) {
        errorEl.innerText = "ত্রুটি: " + error.message;
    }
};

window.logout = () => signOut(auth);

// Toggle Admin Modal
window.toggleAdminModal = () => {
    const modal = document.getElementById('admin-modal');
    modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
};

// Upload Book (Admin Only)
window.uploadBook = async () => {
    if (!isAdmin) return alert("আপনার অ্যাডমিন এক্সেস নেই!");

    const title = document.getElementById('book-title').value.trim();
    const author = document.getElementById('book-author').value.trim();
    const subject = document.getElementById('book-subject').value.trim();
    const file = document.getElementById('book-pdf').files[0];
    const status = document.getElementById('upload-status');

    if (!title || !author || !subject || !file) {
        return alert("সবগুলো ঘর পূরণ করুন এবং PDF সিলেক্ট করুন।");
    }

    try {
        status.innerText = "আপলোড হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন।";
        const filePath = `books/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        await addDoc(collection(db, "books"), {
            title, author, subject, pdfUrl: downloadURL, filePath
        });

        status.innerText = "সফলভাবে আপলোড হয়েছে!";
        document.getElementById('book-title').value = '';
        document.getElementById('book-author').value = '';
        document.getElementById('book-subject').value = '';
        document.getElementById('book-pdf').value = '';
        setTimeout(() => {
            status.innerText = '';
            toggleAdminModal();
            loadBooks();
        }, 1000);
    } catch (error) {
        status.innerText = "আপলোড ব্যর্থ হয়েছে: " + error.message;
    }
};

// Load Books from Firestore
async function loadBooks() {
    const querySnapshot = await getDocs(collection(db, "books"));
    allBooks = [];
    const subjects = new Set();
    const authors = new Set();

    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        allBooks.push({ id: docSnap.id, ...data });
        subjects.add(data.subject);
        authors.add(data.author);
    });

    populateFilters(subjects, authors);
    renderBooks(allBooks);
}

// Populate Navbar Dropdowns
function populateFilters(subjects, authors) {
    const subSelect = document.getElementById('subject-filter');
    const authSelect = document.getElementById('author-filter');

    subSelect.innerHTML = '<option value="">সব সাবজেক্ট</option>';
    subjects.forEach(sub => {
        subSelect.innerHTML += `<option value="${sub}">${sub}</option>`;
    });

    authSelect.innerHTML = '<option value="">সব লেখক</option>';
    authors.forEach(auth => {
        authSelect.innerHTML += `<option value="${auth}">${auth}</option>`;
    });
}

// Filter Books
window.filterBooks = (type) => {
    if (type === 'all') {
        document.getElementById('subject-filter').value = '';
        document.getElementById('author-filter').value = '';
        document.getElementById('section-title').innerText = 'সকল বইসমূহ';
        renderBooks(allBooks);
    }
};

window.filterByDropdown = (filterType) => {
    const subVal = document.getElementById('subject-filter').value;
    const authVal = document.getElementById('author-filter').value;

    let filtered = allBooks;
    if (filterType === 'subject' && subVal) {
        document.getElementById('author-filter').value = '';
        filtered = allBooks.filter(b => b.subject === subVal);
        document.getElementById('section-title').innerText = `সাবজেক্ট: ${subVal}`;
    } else if (filterType === 'author' && authVal) {
        document.getElementById('subject-filter').value = '';
        filtered = allBooks.filter(b => b.author === authVal);
        document.getElementById('section-title').innerText = `লেখক: ${authVal}`;
    } else {
        document.getElementById('section-title').innerText = 'সকল বইসমূহ';
    }
    renderBooks(filtered);
};

// Render Books Cards
function renderBooks(books) {
    const grid = document.getElementById('books-grid');
    grid.innerHTML = '';

    if (books.length === 0) {
        grid.innerHTML = '<p>কোনো বই পাওয়া যায়নি।</p>';
        return;
    }

    books.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `
            <div>
                <h4>${book.title}</h4>
                <p class="book-meta">✍️ লেখক: ${book.author}</p>
                <p class="book-meta">📂 সাবজেক্ট: ${book.subject}</p>
            </div>
            <div class="card-actions">
                <button class="read-btn" onclick="openReader('${book.pdfUrl}', '${book.title}')">পড়ুন</button>
                ${isAdmin ? `<button class="delete-btn" onclick="deleteBook('${book.id}', '${book.filePath}')">🗑️</button>` : ''}
            </div>
        `;
        grid.appendChild(card);
    });
}

// Delete Book (Admin Only)
window.deleteBook = async (id, filePath) => {
    if (!confirm("আপনি কি নিশ্চিত এই বইটি ডিলিট করতে চান?")) return;
    try {
        await deleteDoc(doc(db, "books", id));
        if (filePath) {
            await deleteObject(ref(storage, filePath));
        }
        loadBooks();
    } catch (e) {
        alert("ডিলিট করতে সমস্যা হয়েছে: " + e.message);
    }
};

// Secure PDF Reader (Canvas Rendering - No Download Button)
window.openReader = (url, title) => {
    document.getElementById('reading-book-title').innerText = title;
    document.getElementById('reader-modal').style.display = 'flex';
    pageNum = 1;

    pdfjsLib.getDocument(url).promise.then(pdf => {
        pdfDoc = pdf;
        renderPage(pageNum);
    }).catch(err => {
        alert("বইটি লোড হতে সমস্যা হচ্ছে।");
        closeReader();
    });
};

function renderPage(num) {
    pageRendering = true;
    pdfDoc.getPage(num).then(page => {
        const canvas = document.getElementById('pdf-canvas');
        const ctx = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = { canvasContext: ctx, viewport: viewport };
        page.render(renderContext).promise.then(() => {
            pageRendering = false;
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });
    document.getElementById('page-info').innerText = `পাতা: ${num} / ${pdfDoc.numPages}`;
}

window.prevPage = () => {
    if (pageNum <= 1) return;
    pageNum--;
    if (pageRendering) pageNumPending = pageNum;
    else renderPage(pageNum);
};

window.nextPage = () => {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    if (pageRendering) pageNumPending = pageNum;
    else renderPage(pageNum);
};

window.closeReader = () => {
    document.getElementById('reader-modal').style.display = 'none';
    pdfDoc = null;
};

// Anti-Screenshot & Anti-Print Deterrents
document.addEventListener('keyup', (e) => {
    if (e.key === 'PrintScreen') {
        navigator.clipboard.writeText('');
        alert('স্ক্রিনশট নেওয়া নিষিদ্ধ!');
    }
});

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's' || e.key === 'u')) {
        e.preventDefault();
        alert('এই অপশনটি বন্ধ রাখা হয়েছে!');
    }
});

window.addEventListener('blur', () => {
    document.getElementById('reader-body').classList.add('blur-protection');
});
window.addEventListener('focus', () => {
    document.getElementById('reader-body').classList.remove('blur-protection');
});

// PWA App Installation Logic
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('install-btn');
    installBtn.style.display = 'inline-block';
    installBtn.addEventListener('click', () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => {
            deferredPrompt = null;
            installBtn.style.display = 'none';
        });
    });
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}