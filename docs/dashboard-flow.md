# Alur Data Dashboard: Dari Backend ke Frontend

Dokumen ini menjelaskan alur kerja bagaimana data statistik seperti `totalDebtors`, `totalClaims`, dan `osRecovery` diambil dari database, diproses oleh backend, dan ditampilkan di komponen `Dashboard.jsx` pada frontend.

## Ringkasan Alur

Alur data dapat diringkas dalam beberapa langkah utama:

1.  **Inisiasi di Frontend**: Komponen `Dashboard.jsx` di-mount dan memicu pengambilan data.
2.  **Permintaan API**: Frontend mengirim permintaan HTTP GET ke backend untuk mendapatkan data `Debtor` dan `Claim`.
3.  **Pemrosesan di Backend**: Backend (Fastify) menerima permintaan, mengambil data dari database menggunakan Prisma.
4.  **Respon API**: Backend mengirimkan data yang diminta dalam format JSON.
5.  **Kalkulasi & Tampilan di Frontend**: Frontend menerima data, melakukan kalkulasi untuk statistik, dan menampilkannya di UI.

---

## 1. Frontend (`tugure-brins-fe`)

### Lokasi File: `src/pages/Dashboard.jsx`

#### Pemicu Pengambilan Data

-   Ketika komponen `Dashboard` pertama kali dirender, `useEffect` hook akan dieksekusi.
-   Di dalam `useEffect`, fungsi `loadDashboardData()` dipanggil untuk memulai proses pengambilan data.

```javascript
// src/pages/Dashboard.jsx

useEffect(() => {
  // ...
  loadDashboardData();
}, [period, bypassAuth]);
```

#### Proses Pengambilan Data (`loadDashboardData`)

Fungsi `loadDashboardData` adalah inti dari logika di sisi klien.

1.  **Menggunakan Klien API**: Fungsi ini menggunakan klien API yang telah diabstraksi, yaitu `backend`, yang diimpor dari ` '@/api/backendClient'`.

2.  **Mengirim Permintaan Paralel**: `Promise.all` digunakan untuk mengirim beberapa permintaan API secara bersamaan untuk efisiensi.
    -   `backend.list('Debtor')`: Mengambil daftar semua debitur.
    -   `backend.list('Claim')`: Mengambil daftar semua klaim.

    ```javascript
    // src/pages/Dashboard.jsx

    const loadDashboardData = async () => {
      // ...
      if (useBackendApi) {
        [debtorData, claimData, borderoData] = await Promise.all([
          backend.list('Debtor'),
          backend.list('Claim'),
          backend.list('Bordero')
        ]);
      }
      // ...
    };
    ```

    Panggilan `backend.list('Debtor')` pada dasarnya akan membuat permintaan `GET` ke endpoint backend, seperti `http://localhost:3000/api/entities/Debtor`.

#### Kalkulasi Statistik

Setelah `debtorData` dan `claimData` diterima dari backend:

-   **`totalDebtors`**: Dihitung berdasarkan jumlah total item dalam array `debtorData`.
    ```javascript
    // src/pages/Dashboard.jsx
    totalDebtors: debtorData.length,
    ```

-   **`totalClaims`**: Dihitung berdasarkan jumlah total item dalam array `claimData`.
    ```javascript
    // src/pages/Dashboard.jsx
    totalClaims: claimData.length,
    ```

-   **`osRecovery` (Outstanding Recovery)**: Dihitung dengan mengambil selisih antara total nilai klaim dan total klaim yang sudah dibayar.
    ```javascript
    // src/pages/Dashboard.jsx
    const totalClaimValue = claimData.reduce((sum, c) => sum + (c.nilai_klaim || 0), 0);
    const claimsPaid = claimData.filter(c => c.status === 'Paid').reduce((sum, c) => sum + (c.nilai_klaim || 0), 0);
    // ...
    setStats({
      // ...
      osRecovery: totalClaimValue - claimsPaid,
      // ...
    });
    ```

#### Penyimpanan State dan Tampilan

-   Hasil kalkulasi disimpan dalam state React menggunakan `setStats`.
-   Perubahan state ini memicu komponen untuk me-render ulang dan menampilkan data di dalam komponen `ModernKPI`.

```jsx
// src/pages/Dashboard.jsx

<ModernKPI title="Total Debtors" value={stats.totalDebtors} icon={Users} color="blue" />
<ModernKPI title="OS Recovery" value={`Rp ${formatCurrency(stats.osRecovery)}`} icon={AlertTriangle} color="red" />
<ModernKPI title="Total Claims" value={stats.totalClaims} icon={FileText} color="purple" />
```

---

## 2. Backend (`tugure-brins-be`)

### Lokasi File: `src/routes/entities.js`, `src/controllers/EntityController.js`, `src/services/EntityService.js`, `src/repositories/EntityRepository.js`

#### Penanganan Rute (Routing)

-   Backend Fastify memiliki file rute di `src/routes/entities.js` yang mendefinisikan endpoint generik untuk entitas.
-   Endpoint `GET /:entityName` akan menangani permintaan dari frontend.

```javascript
// src/routes/entities.js (Contoh)

module.exports = async function (fastify, opts) {
  fastify.get('/:entityName', EntityController.list);
  // ... rute lainnya
}
```

#### Controller

-   `EntityController.js` menerima permintaan dan memanggil service yang sesuai.
-   Ia mengambil `entityName` (misalnya, "Debtor") dari parameter URL.

```javascript
// src/controllers/EntityController.js (Contoh)

const EntityService = require('../services/EntityService');

async function list(req, reply) {
  try {
    const { entityName } = req.params;
    const records = await EntityService.list(entityName);
    reply.send(records);
  } catch (error) {
    reply.status(500).send({ message: 'Error fetching data' });
  }
}

module.exports = { list };
```

#### Service dan Repository

-   **`EntityService.js`**: Bertindak sebagai lapisan logika bisnis. Ia meneruskan permintaan ke repository yang sesuai.
-   **`EntityRepository.js`**: Ini adalah lapisan akses data. Ia menggunakan Prisma Client untuk berinteraksi langsung dengan database.

```javascript
// src/repositories/EntityRepository.js (Contoh)

const prisma = require('../prisma/client');

async function list(entityName) {
  // Menggunakan dynamic model name dari Prisma
  const model = prisma[entityName.toLowerCase()];
  if (!model) {
    throw new Error(`Model ${entityName} not found`);
  }
  return model.findMany();
}

module.exports = { list };
```

Fungsi ini secara dinamis memilih model Prisma (`debtor` atau `claim`) berdasarkan `entityName` yang diterima dan menjalankan `findMany()` untuk mengambil semua record dari tabel yang sesuai di database.

Data yang dikembalikan dari `findMany()` kemudian dikirim kembali melalui lapisan Service dan Controller, dan akhirnya sebagai respons API ke frontend.
