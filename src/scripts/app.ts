// app.ts — Main client-side application logic for AULIAAS_MAKEUP
// Handles: Firebase init, testimonials CRUD, modals, calculator, admin dashboard

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import {
    getFirestore,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
} from 'firebase/firestore';

// ──────────────────────────────────────────
// Firebase Init (optional — falls back to local state)
// ──────────────────────────────────────────
declare const __app_id: string | undefined;
declare const __firebase_config: string | undefined;
declare const __initial_auth_token: string | undefined;

const appId = typeof __app_id !== 'undefined' ? __app_id : 'auliaas-makeup-app';
const firebaseConfig = {
                        apiKey: "AIzaSyCyrxqGKQpxKDOe2IUVof1YqjVJA_klH9g",
                        authDomain: "auliaas-makeup.firebaseapp.com",
                        projectId: "auliaas-makeup",
                        storageBucket: "auliaas-makeup.firebasestorage.app",
                        messagingSenderId: "590533396659",
                        appId: "1:590533396659:web:c34c0ba51ae302050a88c6",
                        measurementId: "G-2YZG8H764C"
                        };
const initialAuthToken =
    typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db: ReturnType<typeof getFirestore> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────
interface Testimonial {
    id: string;
    name: string;
    service: string;
    rating: number;
    content: string;
    is_approved: boolean;
    createdAt?: string;
}

// ──────────────────────────────────────────
// Seed Data
// ──────────────────────────────────────────
const defaultTestimonials: Testimonial[] = [
    {
        id: 'seed-1',
        name: 'Dinda Rahmawati',
        service: 'Acara Tunangan (Lamaran)',
        rating: 5,
        content:
            'Make up nya cantik banget! Tahan lama dari pagi acara lamaran sampai malam masih flawless ga crack sama sekali. Banyak yang muji riasan aku. Kak Aulia juga ramah banget!',
        is_approved: true,
    },
    {
        id: 'seed-2',
        name: 'Fitri Handayani',
        service: 'Wisuda Perguruan Tinggi',
        rating: 5,
        content:
            'Booking untuk wisuda kemarin. Hasilnya bener-bener ringan tapi pangling banget. Pemasangan bulu matanya nyaman ga ganjel di mata. Poin plus dapet gratis hijab do juga!',
        is_approved: true,
    },
    {
        id: 'seed-3',
        name: 'Ibu Sari Permata',
        service: 'Karnaval & Pentas Anak',
        rating: 5,
        content:
            'Riasan anak saya untuk acara karnaval sekolah sangat rapi & cantik. Anak tetep nyaman ga risih, harganya sangat terjangkau dengan kualitas yang oke banget!',
        is_approved: true,
    },
];

let testimonials: Testimonial[] = [...defaultTestimonials];
let isAdminLoggedIn = false;

// ──────────────────────────────────────────
// Toast Notification
// ──────────────────────────────────────────
function showToast(message: string, type: 'success' | 'error' = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `px-4 py-3 rounded-2xl text-xs font-semibold shadow-xl transition-all duration-300 transform translate-x-10 opacity-0 flex items-center gap-2 ${
        type === 'error'
            ? 'bg-rose-600 text-white'
            : 'bg-espresso text-cream border border-gold/40'
    }`;
    toast.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-triangle-exclamation text-rose-200' : 'fa-circle-check text-gold'}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-10', 'opacity-0');
    });
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-10');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ──────────────────────────────────────────
// Modal Helpers
// ──────────────────────────────────────────
function openModal(id: string) {
    document.getElementById(id)?.classList.replace('hidden', 'flex');
}
function closeModal(id: string) {
    document.getElementById(id)?.classList.replace('flex', 'hidden');
}

// Lightbox
window.addEventListener('openLightbox', ((e: CustomEvent) => {
    const { img, title } = e.detail;
    (document.getElementById('lightbox-img') as HTMLImageElement).src = img;
    document.getElementById('lightbox-caption')!.textContent = title;
    openModal('lightbox-modal');
}) as EventListener);
document.getElementById('close-lightbox-btn')?.addEventListener('click', () => closeModal('lightbox-modal'));
document.getElementById('lightbox-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('lightbox-modal');
});

// Review Modal
window.addEventListener('openReviewModal', () => openModal('review-modal'));
document.getElementById('close-review-btn')?.addEventListener('click', () => closeModal('review-modal'));

// Admin Login Modal
window.addEventListener('openAdminLogin', () => {
    if (isAdminLoggedIn) {
        openAdminDashboard();
    } else {
        openModal('admin-login-modal');
    }
});
document.getElementById('close-admin-login-btn')?.addEventListener('click', () => closeModal('admin-login-modal'));

// Admin Dashboard Modal
function openAdminDashboard() {
    openModal('admin-dashboard-modal');
    renderAdminLists();
}
document.getElementById('close-admin-dashboard-btn')?.addEventListener('click', () => closeModal('admin-dashboard-modal'));

// Calculator Modal
window.addEventListener('openCalcModal', () => {
    openModal('calc-modal');
    runCalculator();
});
document.getElementById('close-calc-btn')?.addEventListener('click', () => closeModal('calc-modal'));

// Edit Modal
document.getElementById('close-edit-btn')?.addEventListener('click', () => closeModal('edit-modal'));

// Close modals on backdrop click
['review-modal', 'admin-login-modal', 'admin-dashboard-modal', 'calc-modal', 'edit-modal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal(id);
    });
});

// ──────────────────────────────────────────
// Star Rating
// ──────────────────────────────────────────
function setRating(rating: number) {
    (document.getElementById('rev-rating') as HTMLInputElement).value = String(rating);
    document.querySelectorAll<HTMLElement>('#star-selector .star-btn').forEach((star, index) => {
        star.className = index < rating
            ? 'fa-solid fa-star star-btn text-amber-400'
            : 'fa-regular fa-star star-btn text-amber-300';
    });
}

document.querySelectorAll<HTMLElement>('#star-selector .star-btn').forEach(star => {
    star.addEventListener('click', () => {
        setRating(parseInt(star.dataset.rating!));
    });
});

// ──────────────────────────────────────────
// Admin Auth
// ──────────────────────────────────────────
document.getElementById('admin-login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = (document.getElementById('admin-pass-input') as HTMLInputElement).value;
    if (pass === 'admin123' || pass === 'admin') {
        isAdminLoggedIn = true;
        closeModal('admin-login-modal');
        openAdminDashboard();
        showToast('Login Admin Berhasil!');
    } else {
        showToast('Password Admin Salah!', 'error');
    }
});

// Admin tab switching
document.getElementById('tab-btn-pending')?.addEventListener('click', () => switchAdminTab('pending'));
document.getElementById('tab-btn-approved')?.addEventListener('click', () => switchAdminTab('approved'));

function switchAdminTab(tab: 'pending' | 'approved') {
    const pList = document.getElementById('admin-pending-list');
    const aList = document.getElementById('admin-approved-list');
    const btnP = document.getElementById('tab-btn-pending');
    const btnA = document.getElementById('tab-btn-approved');

    if (tab === 'pending') {
        pList?.classList.remove('hidden');
        aList?.classList.add('hidden');
        if (btnP) btnP.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-espresso text-white';
        if (btnA) btnA.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-warm-nude text-espresso';
    } else {
        pList?.classList.add('hidden');
        aList?.classList.remove('hidden');
        if (btnA) btnA.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-espresso text-white';
        if (btnP) btnP.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-warm-nude text-espresso';
    }
}

// ──────────────────────────────────────────
// Review Submission
// ──────────────────────────────────────────
document.getElementById('review-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (document.getElementById('rev-name') as HTMLInputElement).value;
    const service = (document.getElementById('rev-service') as HTMLSelectElement).value;
    const rating = parseInt((document.getElementById('rev-rating') as HTMLInputElement).value) || 5;
    const content = (document.getElementById('rev-content') as HTMLTextAreaElement).value;

    const newReview: Testimonial = {
        id: '',
        name, service, rating, content,
        is_approved: false,
        createdAt: new Date().toISOString(),
    };

    if (db && auth?.currentUser) {
        try {
            const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'testimonials');
            await addDoc(colRef, newReview);
        } catch {
            newReview.id = 'temp-' + Date.now();
            testimonials.push(newReview);
            renderAll();
        }
    } else {
        newReview.id = 'temp-' + Date.now();
        testimonials.push(newReview);
        renderAll();
    }

    (document.getElementById('review-form') as HTMLFormElement).reset();
    setRating(5);
    closeModal('review-modal');
    showToast('Ulasan dikirim! Menunggu persetujuan admin.');
});

// ──────────────────────────────────────────
// Admin CRUD Operations
// ──────────────────────────────────────────
async function approveTestimonial(id: string) {
    const item = testimonials.find(t => t.id === id);
    if (!item) return;
    if (db && auth?.currentUser && !id.startsWith('seed-') && !id.startsWith('temp-')) {
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'testimonials', id), { is_approved: true });
        } catch {
            item.is_approved = true;
            renderAll();
        }
    } else {
        item.is_approved = true;
        renderAll();
    }
    showToast('Testimoni disetujui & tayang!');
}

async function unapproveTestimonial(id: string) {
    const item = testimonials.find(t => t.id === id);
    if (!item) return;
    if (db && auth?.currentUser && !id.startsWith('seed-') && !id.startsWith('temp-')) {
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'testimonials', id), { is_approved: false });
        } catch {
            item.is_approved = false;
            renderAll();
        }
    } else {
        item.is_approved = false;
        renderAll();
    }
    showToast('Status testimoni diubah ke pending.');
}

async function deleteTestimonial(id: string) {
    if (db && auth?.currentUser && !id.startsWith('seed-') && !id.startsWith('temp-')) {
        try {
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'testimonials', id));
        } catch {
            testimonials = testimonials.filter(t => t.id !== id);
            renderAll();
        }
    } else {
        testimonials = testimonials.filter(t => t.id !== id);
        renderAll();
    }
    showToast('Testimoni berhasil dihapus.');
}

function openEditModal(id: string) {
    const item = testimonials.find(t => t.id === id);
    if (!item) return;
    (document.getElementById('edit-id') as HTMLInputElement).value = item.id;
    (document.getElementById('edit-name') as HTMLInputElement).value = item.name;
    (document.getElementById('edit-service') as HTMLInputElement).value = item.service;
    (document.getElementById('edit-rating') as HTMLInputElement).value = String(item.rating);
    (document.getElementById('edit-content') as HTMLTextAreaElement).value = item.content;
    openModal('edit-modal');
}

document.getElementById('edit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = (document.getElementById('edit-id') as HTMLInputElement).value;
    const name = (document.getElementById('edit-name') as HTMLInputElement).value;
    const service = (document.getElementById('edit-service') as HTMLInputElement).value;
    const rating = parseInt((document.getElementById('edit-rating') as HTMLInputElement).value);
    const content = (document.getElementById('edit-content') as HTMLTextAreaElement).value;

    const item = testimonials.find(t => t.id === id);
    if (!item) return;

    if (db && auth?.currentUser && !id.startsWith('seed-') && !id.startsWith('temp-')) {
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'testimonials', id), { name, service, rating, content });
        } catch {
            Object.assign(item, { name, service, rating, content });
            renderAll();
        }
    } else {
        Object.assign(item, { name, service, rating, content });
        renderAll();
    }
    closeModal('edit-modal');
    showToast('Testimoni berhasil diperbarui.');
});

// ──────────────────────────────────────────
// Render Functions
// ──────────────────────────────────────────
function renderPublic() {
    const container = document.getElementById('testimonials-container');
    if (!container) return;
    const approved = testimonials.filter(t => t.is_approved === true);

    if (approved.length === 0) {
        container.innerHTML = `<div class="col-span-3 text-center py-8 text-muted-brown text-sm">Belum ada ulasan yang disetujui.</div>`;
        return;
    }

    container.innerHTML = approved.map(item => `
        <div class="luxury-card p-6 sm:p-8 rounded-3xl flex flex-col justify-between">
            <div class="space-y-4">
                <div class="flex text-amber-400 text-sm gap-1">
                    ${Array.from({ length: item.rating }).map(() => `<i class="fa-solid fa-star"></i>`).join('')}
                </div>
                <p class="text-xs sm:text-sm text-espresso leading-relaxed italic">"${item.content}"</p>
            </div>
            <div class="mt-6 pt-4 border-t border-warm-nude flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-warm-nude border border-gold flex items-center justify-center text-espresso font-serif font-bold text-sm">
                    ${item.name.charAt(0)}
                </div>
                <div>
                    <div class="font-bold text-sm text-espresso">${item.name}</div>
                    <div class="text-[11px] text-muted-brown">${item.service}</div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderAdminLists() {
    const pendingList = document.getElementById('admin-pending-list');
    const approvedList = document.getElementById('admin-approved-list');
    if (!pendingList || !approvedList) return;

    const pending = testimonials.filter(t => !t.is_approved);
    const approved = testimonials.filter(t => t.is_approved);

    document.getElementById('count-pending')!.textContent = String(pending.length);
    document.getElementById('count-approved')!.textContent = String(approved.length);

    const badge = document.getElementById('pending-badge');
    if (badge) {
        badge.textContent = String(pending.length);
        badge.classList.toggle('hidden', pending.length === 0);
    }

    pendingList.innerHTML = pending.length === 0
        ? `<div class="p-6 text-center text-xs text-muted-brown bg-cream rounded-2xl">Tidak ada ulasan pending.</div>`
        : pending.map(item => `
            <div class="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-xs text-espresso">${item.name}</span>
                        <span class="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-semibold">Pending</span>
                    </div>
                    <div class="text-[11px] text-muted-brown">Layanan: ${item.service} | ⭐ ${item.rating}/5</div>
                    <p class="text-xs text-espresso italic font-medium">"${item.content}"</p>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="window.__app.approve('${item.id}')" class="bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold"><i class="fa-solid fa-check"></i> Setujui</button>
                    <button onclick="window.__app.openEdit('${item.id}')" class="bg-espresso text-cream px-3 py-1.5 rounded-xl text-xs font-semibold">Edit</button>
                    <button onclick="window.__app.delete('${item.id}')" class="bg-rose-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold">Hapus</button>
                </div>
            </div>
        `).join('');

    approvedList.innerHTML = approved.length === 0
        ? `<div class="p-6 text-center text-xs text-muted-brown bg-cream rounded-2xl">Belum ada ulasan yang disetujui.</div>`
        : approved.map(item => `
            <div class="p-4 bg-cream border border-warm-nude rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-xs text-espresso">${item.name}</span>
                        <span class="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">Tayang</span>
                    </div>
                    <div class="text-[11px] text-muted-brown">Layanan: ${item.service} | ⭐ ${item.rating}/5</div>
                    <p class="text-xs text-espresso italic">"${item.content}"</p>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="window.__app.unapprove('${item.id}')" class="bg-amber-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold">Unapprove</button>
                    <button onclick="window.__app.openEdit('${item.id}')" class="bg-espresso text-cream px-3 py-1.5 rounded-xl text-xs font-semibold">Edit</button>
                    <button onclick="window.__app.delete('${item.id}')" class="bg-rose-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold">Hapus</button>
                </div>
            </div>
        `).join('');
}

function renderAll() {
    renderPublic();
    renderAdminLists();
}

// Expose admin actions globally for inline onclick handlers in rendered HTML
(window as any).__app = {
    approve: approveTestimonial,
    unapprove: unapproveTestimonial,
    delete: deleteTestimonial,
    openEdit: openEditModal,
};

// ──────────────────────────────────────────
// Calculator
// ──────────────────────────────────────────
function runCalculator() {
    const serviceSelect = document.getElementById('calc-service') as HTMLSelectElement | null;
    const paxInput = document.getElementById('calc-pax') as HTMLInputElement | null;
    const softlensInput = document.getElementById('calc-softlens') as HTMLInputElement | null;
    const areaSelect = document.getElementById('calc-transport-area') as HTMLSelectElement | null;
    const kmContainer = document.getElementById('calc-km-container');
    const kmInput = document.getElementById('calc-km-input') as HTMLInputElement | null;
    const breakdownDetails = document.getElementById('calc-breakdown-details');
    const transportDisplay = document.getElementById('calc-transport-display');
    const totalDisplay = document.getElementById('calc-total-display');
    const noteDisplay = document.getElementById('calc-note-display');

    if (!serviceSelect || !paxInput || !totalDisplay) return;

    const servicePrice = parseInt(serviceSelect.value) || 0;
    const pax = Math.max(1, parseInt(paxInput.value) || 1);
    const hasSoftlens = softlensInput?.checked ?? false;
    const isOutside = areaSelect?.value === 'outside';

    let transportFee = 0;
    let km = 5;

    if (isOutside) {
        kmContainer?.classList.remove('hidden');
        km = Math.max(1, parseFloat(kmInput?.value || '5') || 5);
        const multiplier = Math.ceil(km / 5);
        transportFee = multiplier * 20000;
        if (transportDisplay) {
            transportDisplay.className = 'font-semibold text-espresso';
            transportDisplay.textContent = `Rp ${transportFee.toLocaleString('id-ID')} (${km} KM)`;
        }
        if (noteDisplay) {
            noteDisplay.textContent = `*Luar Citra Raya: ${km} KM (${multiplier}x kelipatan 5 KM @ Rp 20.000)`;
        }
    } else {
        kmContainer?.classList.add('hidden');
        transportFee = 0;
        if (transportDisplay) {
            transportDisplay.className = 'font-semibold text-emerald-700';
            transportDisplay.textContent = 'Rp 0 (FREE Ongkir)';
        }
        if (noteDisplay) {
            noteDisplay.textContent = '*Gratis ongkir untuk Citra Raya & sekitarnya maks. 5 km';
        }
    }

    const serviceTotal = servicePrice * pax;
    const softlensTotal = hasSoftlens ? 35000 * pax : 0;
    const grandTotal = serviceTotal + softlensTotal + transportFee;

    if (breakdownDetails) {
        const parts = [`${pax} pax x Rp ${(servicePrice).toLocaleString('id-ID')}`];
        if (hasSoftlens) parts.push(`Softlens (+Rp ${(softlensTotal).toLocaleString('id-ID')})`);
        breakdownDetails.textContent = parts.join(' + ');
    }

    totalDisplay.textContent = `Rp ${grandTotal.toLocaleString('id-ID')}`;
}

document.getElementById('calc-service')?.addEventListener('change', runCalculator);
document.getElementById('calc-pax')?.addEventListener('input', runCalculator);
document.getElementById('calc-softlens')?.addEventListener('change', runCalculator);
document.getElementById('calc-transport-area')?.addEventListener('change', runCalculator);
document.getElementById('calc-km-input')?.addEventListener('input', runCalculator);

document.querySelectorAll<HTMLButtonElement>('.calc-km-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const kmInput = document.getElementById('calc-km-input') as HTMLInputElement | null;
        if (kmInput && btn.dataset.km) {
            kmInput.value = btn.dataset.km;
            runCalculator();
        }
    });
});

document.getElementById('calc-pax-minus')?.addEventListener('click', () => {
    const input = document.getElementById('calc-pax') as HTMLInputElement;
    if (input) {
        input.value = String(Math.max(1, parseInt(input.value || '1') - 1));
        runCalculator();
    }
});
document.getElementById('calc-pax-plus')?.addEventListener('click', () => {
    const input = document.getElementById('calc-pax') as HTMLInputElement;
    if (input) {
        input.value = String(parseInt(input.value || '1') + 1);
        runCalculator();
    }
});

// Navigate from Calculator to Konsultasi & Reservasi section (#contact)
document.getElementById('calc-continue-btn')?.addEventListener('click', () => {
    const serviceSelect = document.getElementById('calc-service') as HTMLSelectElement | null;
    const paxInput = document.getElementById('calc-pax') as HTMLInputElement | null;
    const softlensInput = document.getElementById('calc-softlens') as HTMLInputElement | null;
    const areaSelect = document.getElementById('calc-transport-area') as HTMLSelectElement | null;
    const kmInput = document.getElementById('calc-km-input') as HTMLInputElement | null;
    const totalDisplay = document.getElementById('calc-total-display');

    const serviceText = serviceSelect?.options[serviceSelect.selectedIndex]?.text || '';
    const pax = paxInput?.value || '1';
    const hasSoftlens = softlensInput?.checked ? 'Ya (+Rp 35k)' : 'Tidak';
    const isOutside = areaSelect?.value === 'outside';
    const locationInfo = isOutside ? `Luar Citra Raya (${kmInput?.value || '5'} km)` : 'Dalam Citra Raya (Free ongkir maks. 5 km)';
    const total = totalDisplay?.textContent || '';

    // Close calculator modal
    closeModal('calc-modal');

    // Pre-fill / sync contact reservation form
    const waService = document.getElementById('wa-form-service') as HTMLSelectElement | null;
    if (waService && serviceSelect) {
        const selectedPrice = serviceSelect.value;
        for (let i = 0; i < waService.options.length; i++) {
            if (waService.options[i].value.includes(selectedPrice)) {
                waService.selectedIndex = i;
                break;
            }
        }
    }

    const waLocation = document.getElementById('wa-form-location') as HTMLInputElement | null;
    if (waLocation && !waLocation.value) {
        waLocation.value = isOutside ? 'Luar Area Citra Raya' : 'Citra Raya - Tangerang';
    }

    const waNotes = document.getElementById('wa-form-notes') as HTMLTextAreaElement | null;
    if (waNotes) {
        waNotes.value = `[Estimasi Kalkulator] Layanan: ${serviceText}, Jumlah: ${pax} pax, Softlens: ${hasSoftlens}, Lokasi: ${locationInfo}, Total: ${total}`;
    }

    // Smooth scroll to Konsultasi & Reservasi section
    const contactSection = document.getElementById('contact');
    if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
            (document.getElementById('wa-form-name') as HTMLInputElement)?.focus();
        }, 400);
    }

    showToast('Silakan lengkapi formulir konsultasi & reservasi Anda ✨');
});

// ──────────────────────────────────────────
// Firebase Init & Snapshot
// ──────────────────────────────────────────
async function initFirebase() {
    if (!firebaseConfig) {
        renderAll();
        return;
    }
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

        if (auth.currentUser) {
            const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'testimonials');
            onSnapshot(colRef, (snapshot) => {
                const fetched: Testimonial[] = [];
                snapshot.forEach(docSnap => {
                    fetched.push({ id: docSnap.id, ...(docSnap.data() as Omit<Testimonial, 'id'>) });
                });
                if (fetched.length > 0) {
                    testimonials = [...defaultTestimonials, ...fetched];
                }
                renderAll();
            }, () => {
                renderAll();
            });
        } else {
            renderAll();
        }
    } catch {
        renderAll();
    }
}

initFirebase();
