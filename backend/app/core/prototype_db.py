import csv
import json
import os
import re
import uuid
import difflib
import random
import time
import math
import tempfile
import sqlite3
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from app.core.logger import logger

import shutil

# Try backend-local datasets first (for Railway Root Directory = /backend), then fallback to repo root
_candidate_dirs = [
    os.path.join(os.path.dirname(__file__), '..', '..', 'datasets'),       # backend/datasets
    os.path.join(os.path.dirname(__file__), '..', '..', '..', 'datasets'), # repo root datasets
    os.path.join(os.getcwd(), 'datasets'),
    os.path.join(os.getcwd(), 'backend', 'datasets'),
    "/var/task/datasets",
    "/var/task/backend/datasets",
]
_src_datasets_dir = next((d for d in _candidate_dirs if os.path.exists(d) and os.path.exists(os.path.join(d, 'core_medicines.csv'))), _candidate_dirs[0])

is_serverless = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
if is_serverless:
    DATASETS_DIR = "/tmp/medora_data"
    os.makedirs(DATASETS_DIR, exist_ok=True)
    if os.path.exists(_src_datasets_dir):
        for fname in os.listdir(_src_datasets_dir):
            src_f = os.path.join(_src_datasets_dir, fname)
            dst_f = os.path.join(DATASETS_DIR, fname)
            if os.path.isfile(src_f) and not os.path.exists(dst_f):
                try:
                    shutil.copy2(src_f, dst_f)
                except Exception:
                    pass
else:
    DATASETS_DIR = _src_datasets_dir

SQLITE_DB_PATH = os.path.join(DATASETS_DIR, 'medora.db')
REGISTERED_USERS_CSV = os.path.join(DATASETS_DIR, 'registered_users.csv')
PARTNER_REQUESTS_JSON = os.path.join(DATASETS_DIR, 'partner_requests.json')
DELETED_USERS_JSON = os.path.join(DATASETS_DIR, 'deleted_users.json')


class PrototypeDataStore:
    def __init__(self):
        self.medicines: Dict[str, dict] = {}
        self.inventory: List[dict] = []
        self.inventory_by_med: Dict[str, List[dict]] = {}
        self.symptoms: List[dict] = []
        self.orders: List[dict] = []
        self.pending_registrations: Dict[str, dict] = {}
        self.users: List[dict] = []
        self.deleted_users: Dict[str, dict] = {}
        self.partner_requests: List[dict] = []
        self.deleted_partner_requests: Dict[str, dict] = {}
        self.otps: Dict[str, str] = {}
        self.missing_medicine_requests: List[dict] = []
        
        # Partner Pharmacy Dark-Store / Node Network
        self.pharmacy_metadata = {
            "PHARM_001": {
                "id": "PHARM_001",
                "name": "Vamanjoor Express Pharmacy",
                "tagline": "⚡ 10-15 Min Instant Hub",
                "address": "Airport Road, Vamanjoor, Mangalore",
                "latitude": 19.0760,
                "longitude": 72.8777,
                "phone": "+91 824 228 1111",
                "rating": 4.9,
                "is_open": True,
                "instant_eligible": True,
                "shop_upi_id": "vamanjoor.pharmacy@upi",
                "shop_upi_qr": "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=vamanjoor.pharmacy@upi%26pn=Vamanjoor%20Pharmacy%26cu=INR",
                "live_terminal_qr": None,
                "terminal_label": "Counter POS Soundbox #1"
            },
            "PHARM_002": {
                "id": "PHARM_002",
                "name": "Kadri Health Mart & 24x7 Chemist",
                "tagline": "⚡ 15-20 Min Quick Store",
                "address": "Kadri Temple Road, Kadri Hills, Mangalore",
                "latitude": 19.1000,
                "longitude": 72.9000,
                "phone": "+91 824 221 2222",
                "rating": 4.8,
                "is_open": True,
                "instant_eligible": True
            },
            "PHARM_003": {
                "id": "PHARM_003",
                "name": "City Central Apex Pharmacy",
                "tagline": "⚡ 20-25 Min Superstore",
                "address": "Hampankatta Apex Circle, MG Road, Mangalore",
                "latitude": 19.0500,
                "longitude": 72.8500,
                "phone": "+91 824 244 3333",
                "rating": 4.7,
                "is_open": True,
                "instant_eligible": True
            }
        }

        # Fast-moving / Most Bought Popular Medicines across local pharmacies
        self.popular_medicine_queries = [
            "Dolo 650", "Paracetamol", "Cetirizine", "Azithromycin", 
            "Pantoprazole", "Amoxicillin", "Cough", "Electral", 
            "Band-Aid", "Vitamin C", "Digene", "Volini", "Saridon", 
            "Vicks", "Montair"
        ]

        # Initialize SQLite database engine & seed from existing records if needed
        self.init_sqlite_db()
        self.load_deleted_users()
        self.load_users()
        self.load_data()
        self.load_deleted_partner_requests()
        self.load_partner_requests()

    def get_db(self) -> sqlite3.Connection:
        """Returns a thread-safe connection to the SQLite database with WAL mode."""
        os.makedirs(os.path.dirname(SQLITE_DB_PATH), exist_ok=True)
        conn = sqlite3.connect(SQLITE_DB_PATH, timeout=30.0)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA journal_mode = WAL;")
            conn.execute("PRAGMA synchronous = NORMAL;")
        except Exception:
            try:
                conn.execute("PRAGMA journal_mode = DELETE;")
            except Exception:
                pass
        return conn

    def init_sqlite_db(self):
        """Initializes SQLite schema and migrates existing CSV/JSON records to SQL."""
        with self.get_db() as conn:
            cur = conn.cursor()
            cur.executescript("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    full_name TEXT NOT NULL,
                    role TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    phone TEXT DEFAULT '',
                    username TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    status TEXT DEFAULT 'active',
                    must_change_password INTEGER DEFAULT 0,
                    address TEXT DEFAULT '',
                    pharmacy_license TEXT DEFAULT '',
                    vehicle_type TEXT DEFAULT '',
                    driving_license TEXT DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
                CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
                CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
                CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

                CREATE TABLE IF NOT EXISTS partner_requests (
                    id TEXT PRIMARY KEY,
                    partner_type TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    phone TEXT DEFAULT '',
                    status TEXT DEFAULT 'pending',
                    submitted_at TEXT NOT NULL,
                    store_name TEXT DEFAULT '',
                    license_no TEXT DEFAULT '',
                    store_address TEXT DEFAULT '',
                    latitude REAL DEFAULT 19.0760,
                    longitude REAL DEFAULT 72.8777,
                    vehicle_type TEXT DEFAULT '',
                    driving_license TEXT DEFAULT '',
                    vehicle_number TEXT DEFAULT '',
                    delivery_zone TEXT DEFAULT '',
                    shift_preference TEXT DEFAULT '',
                    rider_upi_id TEXT DEFAULT '',
                    rider_upi_qr TEXT DEFAULT '',
                    shop_upi_id TEXT DEFAULT '',
                    shop_upi_qr TEXT DEFAULT '',
                    approved_at TEXT,
                    rejected_at TEXT,
                    rejection_reason TEXT,
                    temp_password TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_partner_requests_status ON partner_requests(status);
                CREATE INDEX IF NOT EXISTS idx_partner_requests_email ON partner_requests(email);

                CREATE TABLE IF NOT EXISTS deleted_users (
                    identifier TEXT PRIMARY KEY,
                    id TEXT,
                    email TEXT,
                    username TEXT,
                    role TEXT,
                    deleted_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS deleted_partner_requests (
                    id TEXT PRIMARY KEY,
                    action TEXT NOT NULL,
                    reason TEXT,
                    email TEXT,
                    timestamp TEXT NOT NULL
                );
            """)
            conn.commit()

            try:
                cur.execute("ALTER TABLE partner_requests ADD COLUMN rider_upi_qr TEXT DEFAULT ''")
                conn.commit()
            except Exception:
                pass

            for col in ["allergies", "chronic_conditions", "rider_upi_id", "rider_upi_qr", "shop_upi_id", "shop_upi_qr"]:
                try:
                    cur.execute(f"ALTER TABLE users ADD COLUMN {col} TEXT DEFAULT ''")
                    conn.commit()
                except Exception:
                    pass

            # 1. Seed deleted_users from JSON if table is empty
            cur.execute("SELECT COUNT(*) FROM deleted_users")
            if cur.fetchone()[0] == 0:
                for d in self.get_all_dataset_dirs():
                    path = os.path.join(d, 'deleted_users.json')
                    if os.path.exists(path):
                        try:
                            with open(path, 'r', encoding='utf-8') as f:
                                data = json.load(f)
                                if isinstance(data, dict):
                                    for k, v in data.items():
                                        del_at = v.get("deleted_at", datetime.now().isoformat()) if isinstance(v, dict) else datetime.now().isoformat()
                                        cur.execute("INSERT OR IGNORE INTO deleted_users (identifier, deleted_at) VALUES (?, ?)", (k.lower(), del_at))
                        except Exception as e:
                            logger.error(f"Error seeding deleted_users from {path}: {e}")
                conn.commit()

            # 2. Seed deleted_partner_requests from JSON if table is empty
            cur.execute("SELECT COUNT(*) FROM deleted_partner_requests")
            if cur.fetchone()[0] == 0:
                for d in self.get_all_dataset_dirs():
                    path = os.path.join(d, 'deleted_partner_requests.json')
                    if os.path.exists(path):
                        try:
                            with open(path, 'r', encoding='utf-8') as f:
                                data = json.load(f)
                                if isinstance(data, dict):
                                    for k, v in data.items():
                                        action = v.get("action", "deleted") if isinstance(v, dict) else "deleted"
                                        ts = v.get("timestamp", datetime.now().isoformat()) if isinstance(v, dict) else datetime.now().isoformat()
                                        em = v.get("email") if isinstance(v, dict) else None
                                        re = v.get("reason") if isinstance(v, dict) else None
                                        cur.execute("INSERT OR IGNORE INTO deleted_partner_requests (id, action, reason, email, timestamp) VALUES (?, ?, ?, ?, ?)",
                                                    (k, action, re, em, ts))
                        except Exception as e:
                            logger.error(f"Error seeding deleted_partner_requests from {path}: {e}")
                conn.commit()

            # 3. Migrate users from registered_users.csv if table is empty
            cur.execute("SELECT COUNT(*) FROM users")
            if cur.fetchone()[0] == 0:
                logger.info(f"Users SQL table empty. Migrating accounts to SQLite at {SQLITE_DB_PATH}...")
                default_users = [
                    {
                        "id": "usr_admin_1",
                        "full_name": "MEDORA System Administrator",
                        "role": "admin",
                        "email": "admin@medora.com",
                        "phone": "+919000000000",
                        "username": "admin",
                        "password": "admin",
                        "status": "active",
                        "must_change_password": 0,
                        "address": "",
                        "pharmacy_license": "",
                        "vehicle_type": "",
                        "driving_license": "",
                        "created_at": "2026-01-01T00:00:00Z"
                    },
                    {
                        "id": "usr_patient_1",
                        "full_name": "Adhwaith (Patient)",
                        "role": "patient",
                        "email": "patient@medora.com",
                        "phone": "+919999999999",
                        "username": "patient",
                        "password": "patient123",
                        "status": "active",
                        "must_change_password": 0,
                        "address": "",
                        "pharmacy_license": "",
                        "vehicle_type": "",
                        "driving_license": "",
                        "created_at": "2026-01-01T00:00:00Z"
                    },
                    {
                        "id": "usr_pharmacy_1",
                        "full_name": "Vamanjoor Pharmacy Admin",
                        "role": "pharmacy",
                        "email": "pharmacy@medora.com",
                        "phone": "+918888888888",
                        "username": "pharmacy",
                        "password": "pharmacy123",
                        "status": "active",
                        "must_change_password": 0,
                        "address": "Airport Road, Vamanjoor",
                        "pharmacy_license": "KA-MN-2024-PH998",
                        "vehicle_type": "",
                        "driving_license": "",
                        "created_at": "2026-01-01T00:00:00Z"
                    },
                    {
                        "id": "usr_rider_1",
                        "full_name": "Rider AGT-591",
                        "role": "delivery",
                        "email": "rider@medora.com",
                        "phone": "+917777777777",
                        "username": "rider",
                        "password": "rider123",
                        "status": "active",
                        "must_change_password": 0,
                        "address": "Kodialbail, Mangalore",
                        "pharmacy_license": "",
                        "vehicle_type": "Electric Scooter",
                        "driving_license": "DL-KA19-202300091",
                        "created_at": "2026-01-01T00:00:00Z"
                    }
                ]

                csv_source = REGISTERED_USERS_CSV
                if os.path.exists('/tmp/medora_registered_users.csv'):
                    csv_source = '/tmp/medora_registered_users.csv'

                ingested_emails = set()
                if os.path.exists(csv_source):
                    try:
                        with open(csv_source, mode='r', encoding='utf-8') as f:
                            reader = csv.DictReader(f)
                            for row in reader:
                                em = str(row.get("email", "")).strip().lower()
                                uid = str(row.get("id", "")).strip().lower()
                                un = str(row.get("username", "")).strip().lower()
                                if not em: continue

                                cur.execute("SELECT identifier FROM deleted_users WHERE LOWER(identifier) IN (?, ?, ?)", (em, uid, un))
                                if cur.fetchone():
                                    continue

                                passw = row.get("password", "")
                                if un == "admin" or em == "admin@medora.com":
                                    passw = "admin"
                                # Flag temp passwords for pharmacies and riders
                                must_change = 1 if passw in ["Pharmacy123", "Delivery123"] else int(row.get("must_change_password", 0) or 0)

                                cur.execute("""
                                    INSERT OR IGNORE INTO users (
                                        id, full_name, role, email, phone, username, password, status,
                                        must_change_password, address, pharmacy_license, vehicle_type,
                                        driving_license, created_at
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                """, (
                                    row.get("id") or f"usr_{uuid.uuid4().hex[:8]}",
                                    row.get("full_name") or "User",
                                    row.get("role", "patient"),
                                    row.get("email").strip(),
                                    row.get("phone", ""),
                                    row.get("username", em.split("@")[0]),
                                    passw,
                                    row.get("status", "active"),
                                    must_change,
                                    row.get("address", ""),
                                    row.get("pharmacy_license", ""),
                                    row.get("vehicle_type", ""),
                                    row.get("driving_license", ""),
                                    row.get("created_at", datetime.now().isoformat() + "Z")
                                ))
                                ingested_emails.add(em)
                    except Exception as e:
                        logger.error(f"Error reading CSV during SQLite migration: {e}")

                for du in default_users:
                    em = du["email"].lower()
                    if em not in ingested_emails:
                        cur.execute("SELECT identifier FROM deleted_users WHERE LOWER(identifier) = ?", (em,))
                        if not cur.fetchone():
                            cur.execute("""
                                INSERT OR IGNORE INTO users (
                                    id, full_name, role, email, phone, username, password, status,
                                    must_change_password, address, pharmacy_license, vehicle_type,
                                    driving_license, created_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """, (
                                du["id"], du["full_name"], du["role"], du["email"], du["phone"],
                                du["username"], du["password"], du["status"], du["must_change_password"],
                                du["address"], du["pharmacy_license"], du["vehicle_type"],
                                du["driving_license"], du["created_at"]
                            ))
                conn.commit()

            # 4. Migrate partner requests from JSON if table is empty
            cur.execute("SELECT COUNT(*) FROM partner_requests")
            if cur.fetchone()[0] == 0:
                logger.info(f"Partner requests SQL table empty. Migrating applications to SQLite...")
                candidate_paths = [PARTNER_REQUESTS_JSON]
                for d in self.get_all_dataset_dirs():
                    p = os.path.join(d, 'partner_requests.json')
                    if p not in candidate_paths:
                        candidate_paths.append(p)

                for path in candidate_paths:
                    if os.path.exists(path):
                        try:
                            with open(path, 'r', encoding='utf-8') as f:
                                data = json.load(f)
                                if isinstance(data, list):
                                    for item in data:
                                        req_id = item.get("id")
                                        if not req_id: continue
                                        cur.execute("SELECT id FROM deleted_partner_requests WHERE id = ?", (req_id,))
                                        if cur.fetchone():
                                            continue
                                        cur.execute("""
                                            INSERT OR IGNORE INTO partner_requests (
                                                id, partner_type, full_name, email, phone, status, submitted_at,
                                                store_name, license_no, store_address, latitude, longitude,
                                                vehicle_type, driving_license, vehicle_number, delivery_zone,
                                                shift_preference, rider_upi_id, shop_upi_id, shop_upi_qr
                                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                        """, (
                                            req_id, item.get("partner_type", "pharmacy"), item.get("full_name", ""),
                                            item.get("email", ""), item.get("phone", ""), item.get("status", "pending"),
                                            item.get("submitted_at", datetime.now().isoformat()),
                                            item.get("store_name", ""), item.get("license_no", ""),
                                            item.get("store_address", ""), float(item.get("latitude") or 19.0760),
                                            float(item.get("longitude") or 72.8777), item.get("vehicle_type", ""),
                                            item.get("driving_license", ""), item.get("vehicle_number", ""),
                                            item.get("delivery_zone", ""), item.get("shift_preference", ""),
                                            item.get("rider_upi_id", ""), item.get("shop_upi_id", ""),
                                            item.get("shop_upi_qr", "")
                                        ))
                        except Exception as e:
                            logger.error(f"Error migrating partner requests from {path}: {e}")
                conn.commit()

                cur.execute("SELECT COUNT(*) FROM partner_requests")
                if cur.fetchone()[0] == 0:
                    demo_requests = [
                        ("req_pharm_demo1", "pharmacy", "Dr. Rajesh Pai", "rajesh.pai@medoralabs.in", "+91 98450 12345",
                         "pending", "2026-09-29T06:00:00Z", "Pai Apex Chemist & Care", "KA-MAN-2024-99881",
                         "City Light Circle, Kadri, Mangalore", 19.0820, 72.8850, "", "", "", "", "", "", "", ""),
                        ("req_deliv_demo2", "delivery", "Suresh Gowda", "suresh.gowda@gmail.com", "+91 97412 88877",
                         "pending", "2026-09-29T06:15:00Z", "", "", "", 19.0760, 72.8777, "Electric Scooter",
                         "DL-KA19-2022-77665", "", "", "", "", "", "")
                    ]
                    for dr in demo_requests:
                        cur.execute("SELECT id FROM deleted_partner_requests WHERE id = ?", (dr[0],))
                        if not cur.fetchone():
                            cur.execute("""
                                INSERT OR IGNORE INTO partner_requests (
                                    id, partner_type, full_name, email, phone, status, submitted_at,
                                    store_name, license_no, store_address, latitude, longitude,
                                    vehicle_type, driving_license, vehicle_number, delivery_zone,
                                    shift_preference, rider_upi_id, shop_upi_id, shop_upi_qr
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """, dr)
                    conn.commit()
        logger.info(f"SQLite SQL database ready and indexed at {SQLITE_DB_PATH}")

    def calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Haversine formula to compute geodesic distance in kilometers between two coordinates."""
        try:
            R = 6371.0 # Earth radius in km
            dlat = math.radians(lat2 - lat1)
            dlon = math.radians(lon2 - lon1)
            a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            return round(R * c, 1)
        except Exception:
            return 1.2

    def estimate_delivery_time(self, distance_km: float) -> str:
        """Calculates Instamart-style delivery duration based on distance."""
        if distance_km <= 1.5:
            return "10-12 mins"
        elif distance_km <= 2.8:
            return "12-15 mins"
        elif distance_km <= 4.5:
            return "15-20 mins"
        elif distance_km <= 6.5:
            return "20-25 mins"
        else:
            return "30-40 mins"

    def get_all_dataset_dirs(self) -> List[str]:
        """Returns all existing dataset directories across backend-local and repo-root."""
        dirs = []
        for d in _candidate_dirs:
            abs_d = os.path.abspath(d)
            if os.path.exists(abs_d) and abs_d not in dirs:
                dirs.append(abs_d)
        if not dirs:
            dirs.append(DATASETS_DIR)
        return dirs

    def load_deleted_users(self):
        """Loads tombstone records from SQLite into memory dictionary."""
        self.deleted_users = {}
        try:
            with self.get_db() as conn:
                cur = conn.cursor()
                cur.execute("SELECT * FROM deleted_users")
                for r in cur.fetchall():
                    self.deleted_users[r["identifier"].strip().lower()] = dict(r)
        except Exception as e:
            logger.error(f"Error loading deleted users from SQLite: {e}")

    def save_deleted_users(self):
        """Mirrors deleted user tombstones across JSON files for backup/visibility."""
        for d in self.get_all_dataset_dirs():
            path = os.path.join(d, 'deleted_users.json')
            try:
                with open(path, 'w', encoding='utf-8') as f:
                    json.dump(self.deleted_users, f, indent=2)
            except Exception as e:
                logger.error(f"Failed to mirror deleted users to {path}: {e}")

    def load_users(self):
        """Loads registered user credentials directly from registered_users.csv and syncs to SQLite."""
        self.load_deleted_users()
        loaded = []
        seen_emails = set()
        seen_ids = set()

        # Primary load from registered_users.csv across dataset dirs
        for d in self.get_all_dataset_dirs():
            path = os.path.join(d, 'registered_users.csv')
            if os.path.exists(path):
                try:
                    with open(path, mode='r', encoding='utf-8') as f:
                        reader = csv.DictReader(f)
                        for r in reader:
                            uid = str(r.get("id", "")).strip().lower()
                            uemail = str(r.get("email", "")).strip().lower()
                            uname = str(r.get("username", "")).strip().lower()
                            if not uemail:
                                continue
                            if uid in self.deleted_users or uemail in self.deleted_users or uname in self.deleted_users:
                                continue
                            if uemail in seen_emails or uid in seen_ids:
                                continue

                            d_user = dict(r)
                            must_val = d_user.get("must_change_password", 0)
                            d_user["must_change_password"] = bool(int(must_val)) if str(must_val).isdigit() else bool(must_val)
                            loaded.append(d_user)
                            seen_emails.add(uemail)
                            seen_ids.add(uid)
                except Exception as e:
                    logger.error(f"Error reading users from CSV {path}: {e}")

        # Ensure default accounts are present
        default_users = [
            {"id": "usr_admin_1", "full_name": "MEDORA System Administrator", "role": "admin", "email": "admin@medora.com", "phone": "+919000000000", "username": "admin", "password": "admin", "status": "active", "must_change_password": False, "address": "", "pharmacy_license": "", "vehicle_type": "", "driving_license": "", "created_at": "2026-01-01T00:00:00Z"},
            {"id": "usr_patient_1", "full_name": "Adhwaith (Patient)", "role": "patient", "email": "patient@medora.com", "phone": "+919999999999", "username": "patient", "password": "patient123", "status": "active", "must_change_password": False, "address": "", "pharmacy_license": "", "vehicle_type": "", "driving_license": "", "created_at": "2026-01-01T00:00:00Z"},
            {"id": "usr_pharmacy_1", "full_name": "Vamanjoor Pharmacy Admin", "role": "pharmacy", "email": "pharmacy@medora.com", "phone": "+918888888888", "username": "pharmacy", "password": "pharmacy123", "status": "active", "must_change_password": False, "address": "Airport Road, Vamanjoor", "pharmacy_license": "KA-MN-2024-PH998", "vehicle_type": "", "driving_license": "", "created_at": "2026-01-01T00:00:00Z"},
            {"id": "usr_rider_1", "full_name": "Rider AGT-591", "role": "delivery", "email": "rider@medora.com", "phone": "+917777777777", "username": "rider", "password": "rider123", "status": "active", "must_change_password": False, "address": "Kodialbail, Mangalore", "pharmacy_license": "", "vehicle_type": "Electric Scooter", "driving_license": "DL-KA19-202300091", "created_at": "2026-01-01T00:00:00Z"}
        ]
        for du in default_users:
            em = du["email"].lower()
            if em not in seen_emails and em not in self.deleted_users:
                loaded.append(du)
                seen_emails.add(em)
                seen_ids.add(du["id"].lower())

        self.users = loaded
        self.save_users_to_csv()
        self.sync_users_to_sqlite()
        logger.info(f"Loaded {len(self.users)} active credentials from registered_users.csv.")

    def sync_users_to_sqlite(self):
        """Synchronizes in-memory and CSV users into SQLite table."""
        try:
            with self.get_db() as conn:
                cur = conn.cursor()
                for u in self.users:
                    must_val = 1 if u.get("must_change_password") else 0
                    cur.execute("""
                        INSERT OR REPLACE INTO users (
                            id, full_name, role, email, phone, username, password, status,
                            must_change_password, address, pharmacy_license, vehicle_type,
                            driving_license, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        u.get("id"), u.get("full_name", "User"), u.get("role", "patient"),
                        u.get("email").strip(), u.get("phone", ""), u.get("username", ""),
                        u.get("password", ""), u.get("status", "active"),
                        must_val, u.get("address", ""), u.get("pharmacy_license", ""),
                        u.get("vehicle_type", ""), u.get("driving_license", ""),
                        u.get("created_at", datetime.now().isoformat())
                    ))
                conn.commit()
        except Exception as e:
            logger.error(f"Error syncing users to SQLite: {e}")

    def save_users_to_csv(self):
        """Saves user credentials directly to registered_users.csv across all dataset directories."""
        fieldnames = [
            "id", "full_name", "role", "email", "phone", 
            "username", "password", "status", "must_change_password", "address",
            "pharmacy_license", "vehicle_type", "driving_license", "created_at"
        ]
        clean_users = [
            u for u in self.users
            if str(u.get("id", "")).strip().lower() not in self.deleted_users
            and str(u.get("email", "")).strip().lower() not in self.deleted_users
            and str(u.get("username", "")).strip().lower() not in self.deleted_users
        ]

        for d in self.get_all_dataset_dirs():
            path = os.path.join(d, 'registered_users.csv')
            try:
                with open(path, mode='w', newline='', encoding='utf-8') as f:
                    writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
                    writer.writeheader()
                    for u in clean_users:
                        row = dict(u)
                        row["must_change_password"] = 1 if row.get("must_change_password") else 0
                        writer.writerow(row)
            except Exception as e:
                logger.error(f"Failed to write users to CSV at {path}: {e}")

    def load_data(self):
        med_path = os.path.join(DATASETS_DIR, 'core_medicines.csv')
        if os.path.exists(med_path):
            with open(med_path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    self.medicines[row["medicine_id"]] = row
            logger.info(f"Loaded {len(self.medicines)} medicines from {med_path}")
        else:
            logger.error(f"Failed to load medicines: file not found at {med_path}")

        inv_path = os.path.join(DATASETS_DIR, 'pharmacy_inventory.csv')
        if os.path.exists(inv_path):
            with open(inv_path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    self.inventory.append(row)
                    mid = row.get("medicine_id")
                    if mid:
                        if mid not in self.inventory_by_med:
                            self.inventory_by_med[mid] = []
                        self.inventory_by_med[mid].append(row)
            logger.info(f"Loaded {len(self.inventory)} inventory records across partner pharmacies from {inv_path}")
        else:
            logger.error(f"Failed to load inventory: file not found at {inv_path}")

        sym_path = os.path.join(DATASETS_DIR, 'ai_symptom_training.json')
        if os.path.exists(sym_path):
            with open(sym_path, mode='r', encoding='utf-8') as f:
                self.symptoms = json.load(f)
            logger.info(f"Loaded {len(self.symptoms)} symptom records from {sym_path}")
        else:
            logger.error(f"Failed to load symptoms: file not found at {sym_path}")

    def get_pharmacy_coords(self, pharmacy_id: str, user_lat: float = 19.0760, user_lng: float = 72.8777) -> tuple:
        """
        Dynamically calculates pharmacy coordinates.
        If user is far (>30 km) from default base coordinates (19.0760, 72.8777),
        partner pharmacies are anchored around the user's live GPS coordinates with small realistic offsets
        so instant 10-15m delivery works anywhere the user evaluates the app.
        """
        base_meta = self.pharmacy_metadata.get(pharmacy_id, {})
        base_lat = base_meta.get("latitude", 19.0760)
        base_lng = base_meta.get("longitude", 72.8777)

        raw_dist = self.calculate_distance(user_lat, user_lng, 19.0760, 72.8777)
        if raw_dist <= 30.0:
            return base_lat, base_lng

        # Micro-offsets around user's live GPS (0.01 deg ~= 1.11 km)
        offsets = {
            "PHARM_001": (+0.0062, +0.0055),  # ~0.9 km (North-East) - 10-12 mins
            "PHARM_002": (-0.0115, +0.0082),  # ~1.6 km (South-East) - 12-15 mins
            "PHARM_003": (+0.0165, -0.0140),  # ~2.7 km (North-West) - 15-20 mins
        }
        d_lat, d_lng = offsets.get(pharmacy_id, (0.005, 0.005))
        return round(user_lat + d_lat, 6), round(user_lng + d_lng, 6)

    def get_pharmacy_network(self, user_lat: float = 19.0760, user_lng: float = 72.8777, max_distance_km: float = 10.0) -> List[dict]:
        """Returns connected partner pharmacies with distance and delivery speed relative to user location and perimeter."""
        network = []
        for pid, meta in self.pharmacy_metadata.items():
            p_lat, p_lng = self.get_pharmacy_coords(pid, user_lat, user_lng)
            dist = self.calculate_distance(user_lat, user_lng, p_lat, p_lng)
            delivery_estimate = self.estimate_delivery_time(dist)
            in_perimeter = dist <= max_distance_km
            
            # Count in-stock products
            pharm_stock_count = sum(1 for inv in self.inventory if inv.get("pharmacy_id") == pid and int(inv.get("quantity_available", 0)) > 0)

            network.append({
                **meta,
                "latitude": p_lat,
                "longitude": p_lng,
                "distance_km": dist,
                "delivery_time": delivery_estimate,
                "active_stock_count": pharm_stock_count,
                "in_perimeter": in_perimeter,
                "is_fastest": False
            })
            
        network.sort(key=lambda x: x["distance_km"])
        if network:
            network[0]["is_fastest"] = True
        return network

    def get_medicine_local_stock(self, medicine_id: str, user_lat: float = 19.0760, user_lng: float = 72.8777, max_distance_km: float = 10.0) -> dict:
        """Finds live inventory availability of a medicine across all local pharmacy nodes within perimeter."""
        inv_records = self.inventory_by_med.get(medicine_id, [])
        stores = []
        total_quantity = 0

        for inv in inv_records:
            qty = int(inv.get("quantity_available", 0))
            if qty > 0:
                pid = inv.get("pharmacy_id")
                meta = self.pharmacy_metadata.get(pid, {
                    "id": pid,
                    "name": f"Pharmacy {pid}",
                    "latitude": float(inv.get("latitude", 19.0760)),
                    "longitude": float(inv.get("longitude", 72.8777)),
                    "rating": 4.8
                })
                p_lat, p_lng = self.get_pharmacy_coords(pid, user_lat, user_lng)
                dist = self.calculate_distance(user_lat, user_lng, p_lat, p_lng)
                delivery_time = self.estimate_delivery_time(dist)
                in_perimeter = dist <= max_distance_km

                stores.append({
                    "pharmacy_id": pid,
                    "pharmacy_name": meta["name"],
                    "latitude": p_lat,
                    "longitude": p_lng,
                    "quantity": qty,
                    "price": float(inv.get("price") or 0),
                    "distance_km": dist,
                    "in_perimeter": in_perimeter,
                    "delivery_time": delivery_time,
                    "expiry_date": inv.get("expiry_date", "")
                })
                total_quantity += qty

        stores.sort(key=lambda s: s["distance_km"])
        
        in_stock = len(stores) > 0
        in_perimeter_stores = [s for s in stores if s["in_perimeter"]]
        nearest = in_perimeter_stores[0] if in_perimeter_stores else (stores[0] if in_stock else None)

        if not in_stock:
            badge = "Out of Stock Nearby"
        elif in_perimeter_stores:
            badge = f"⚡ {nearest['delivery_time']} from {nearest['pharmacy_name']} ({nearest['distance_km']} km)"
        else:
            badge = f"⚠️ Outside Perimeter ({nearest['distance_km']} km away)"

        return {
            "in_stock": in_stock,
            "in_perimeter": len(in_perimeter_stores) > 0,
            "total_available": total_quantity,
            "stores_count": len(stores),
            "nearest_pharmacy": nearest,
            "all_stores": stores,
            "perimeter_stores": in_perimeter_stores,
            "faster_delivery_badge": badge
        }

    def get_instamart_popular_catalog(self, user_lat: float = 19.0760, user_lng: float = 72.8777, max_distance_km: float = 10.0) -> List[dict]:
        """Retrieves high-demand/most bought medicines with real-time stock and fastest delivery times."""
        catalog = []
        seen_ids = set()

        for term in self.popular_medicine_queries:
            results = self.search_medicines(term)
            for med in results[:2]: # top matches
                mid = med["medicine_id"]
                if mid in seen_ids:
                    continue
                seen_ids.add(mid)
                
                stock_info = self.get_medicine_local_stock(mid, user_lat, user_lng, max_distance_km=max_distance_km)
                catalog.append({
                    **med,
                    "instamart": stock_info
                })
                if len(catalog) >= 12:
                    break
            if len(catalog) >= 12:
                break
                
        return catalog

    def search_medicines(self, query: str) -> List[dict]:
        query = query.strip().lower()
        if not query:
            return []
            
        scored_results = []
        for med in self.medicines.values():
            brand = med["brand_name"].lower()
            generic = med["generic_name"].lower()
            usage = med.get("usage_indication", "").lower()
            
            score = 0
            if brand == query:
                score = 150
            elif generic == query:
                score = 140
            elif brand.startswith(query):
                score = 100
            elif generic.startswith(query):
                score = 80
            elif query in brand:
                score = 50
            elif query in generic:
                score = 40
            elif query in usage:
                score = 20
                
            if score > 0:
                scored_results.append((score, med))
                
        if not scored_results:
            for med in self.medicines.values():
                brand = med["brand_name"].lower()
                generic = med["generic_name"].lower()
                
                brand_words = brand.replace(",", "").replace("-", " ").split()
                gen_words = generic.replace(",", "").replace("-", " ").split()
                
                brand_ratios = [difflib.SequenceMatcher(None, query, w).ratio() for w in brand_words]
                gen_ratios = [difflib.SequenceMatcher(None, query, w).ratio() for w in gen_words]
                
                max_ratio = max(brand_ratios + gen_ratios + [0])
                if max_ratio >= 0.62:
                    score = int(max_ratio * 100)
                    scored_results.append((score, med))

        scored_results.sort(key=lambda x: (-x[0], x[1]["brand_name"].lower()))
        return [med for _, med in scored_results[:12]]

    def search_medicines_instamart(self, query: str, user_lat: float = 19.0760, user_lng: float = 72.8777) -> List[dict]:
        """Search medicines with enriched local pharmacy inventory details."""
        raw_results = self.search_medicines(query)
        enriched = []
        for med in raw_results:
            stock_info = self.get_medicine_local_stock(med["medicine_id"], user_lat, user_lng)
            enriched.append({
                **med,
                "instamart": stock_info
            })
        return enriched

    def get_alternative(self, medicine_id: str) -> List[dict]:
        med = self.medicines.get(medicine_id)
        if not med: return []
        generic = med["generic_name"].lower()
        alternatives = [
            alt for alt in self.medicines.values()
            if alt["medicine_id"] != medicine_id and alt["generic_name"].lower() == generic
        ]
        alternatives.sort(key=lambda x: float(x["price_mrp"]))
        return alternatives

    def get_availability(self, medicine_id: str) -> List[dict]:
        return [inv for inv in self.inventory if inv["medicine_id"] == medicine_id and int(inv["quantity_available"]) > 0]

    def create_order(
        self,
        order_id: str,
        user_id: str,
        items: List[dict],
        type_d: str,
        distance: str,
        pharmacy_id: str = "Vamanjoor Pharmacy, Mangalore",
        prescription_id: Optional[str] = None,
        payment_method: str = "cod",
        payment_status: str = "unpaid",
        payment_id: Optional[str] = None,
        delivery_address: Optional[dict] = None
    ):
        logger.info(f"DB: Saving order {order_id} for user {user_id} with delivery to {delivery_address}")
        new_order = {
            "id": order_id,
            "user": user_id,
            "items": items,
            "type": type_d,
            "distance": distance,
            "pharmacy_id": pharmacy_id,
            "prescription_id": prescription_id,
            "payment_method": payment_method,
            "payment_status": payment_status,
            "payment_id": payment_id or f"PAY-{uuid.uuid4().hex[:8].upper()}",
            "status": "pending",
            "delivery_address": delivery_address,
            "created_at": datetime.now().isoformat()
        }
        self.orders.append(new_order)
        return new_order

    def get_orders_by_status(self, status: Optional[str] = None) -> List[dict]:
        if status and status.lower() not in ["active", "all"]:
            statuses = [s.strip().lower() for s in status.split(",") if s.strip()]
            return [o for o in self.orders if str(o.get("status", "")).lower() in statuses]
        return [o for o in self.orders if str(o.get("status", "")).lower() in ["pending", "accepted", "ready"]]

    def get_active_orders(self) -> List[dict]:
        return self.get_orders_by_status("pending")

    def get_user_orders(self, user_id: str) -> List[dict]:
        clean_target = str(user_id).strip().lower()
        return [
            o for o in self.orders
            if str(o.get("user", "")).strip().lower() == clean_target
            or str(o.get("user_id", "")).strip().lower() == clean_target
        ]

    def update_order_status(self, order_id: str, new_status: str):
        for o in self.orders:
            if o["id"] == order_id:
                o["status"] = new_status
                return o
        return None

    def sync_inventory(self, pharmacy_id: str, medicine_name: str, generic: str, quantity: int, expiry: str, manufacturer: str):
        matched_med = None
        med_name_clean = medicine_name.lower().strip()
        gen_name_clean = generic.lower().strip() if generic else ""
        
        for med in self.medicines.values():
            if med_name_clean in med["brand_name"].lower() or (gen_name_clean and gen_name_clean in med["generic_name"].lower()):
                matched_med = med
                break
                
        if not matched_med:
            med_id = f"MED_MOCK_{uuid.uuid4().hex[:6].upper()}"
            matched_med = {
                "medicine_id": med_id,
                "brand_name": medicine_name,
                "generic_name": generic or "Generic Composition",
                "category": "Prescription",
                "dosage": "1 Unit",
                "form": "Tablet",
                "manufacturer": manufacturer or "Unknown Manufacturer",
                "price_mrp": "100.00",
                "usage_indication": "Custom Sync"
            }
            self.medicines[med_id] = matched_med
            
        med_id = matched_med["medicine_id"]
        
        existing_inv = None
        for inv in self.inventory:
            if inv.get("pharmacy_id") == pharmacy_id and inv.get("medicine_id") == med_id:
                existing_inv = inv
                break
                
        if existing_inv:
            new_qty = int(existing_inv.get("quantity_available", 0)) + quantity
            existing_inv["quantity_available"] = str(new_qty)
            if expiry:
                existing_inv["expiry_date"] = expiry
            existing_inv["last_updated"] = datetime.now().isoformat() + "Z"
            return {
                "medicine": matched_med,
                "inventory": existing_inv
            }
        else:
            new_inv = {
                "pharmacy_id": pharmacy_id,
                "medicine_id": med_id,
                "quantity_available": str(quantity),
                "expiry_date": expiry or "2029-12-31",
                "last_updated": datetime.now().isoformat() + "Z",
                "price": matched_med["price_mrp"],
                "latitude": "19.0760",
                "longitude": "72.8777"
            }
            self.inventory.append(new_inv)
            if med_id not in self.inventory_by_med:
                self.inventory_by_med[med_id] = []
            self.inventory_by_med[med_id].append(new_inv)
            return {
                "medicine": matched_med,
                "inventory": new_inv
            }

    def find_user(self, identifier: str) -> Optional[dict]:
        if not identifier: return None
        identifier_clean = identifier.strip().lower()
        clean_phone = identifier_clean.replace(" ", "").replace("-", "")

        try:
            with self.get_db() as conn:
                cur = conn.cursor()
                cur.execute("SELECT identifier FROM deleted_users WHERE LOWER(identifier) = ? OR LOWER(email) = ? OR LOWER(username) = ?",
                            (identifier_clean, identifier_clean, identifier_clean))
                if cur.fetchone():
                    return None

                cur.execute("""
                    SELECT id, full_name, role, email, phone, username, password, status,
                           must_change_password, address, pharmacy_license, vehicle_type,
                           driving_license, created_at, updated_at
                    FROM users
                    WHERE LOWER(email) = ? 
                       OR LOWER(username) = ? 
                       OR LOWER(id) = ? 
                       OR (phone != '' AND REPLACE(REPLACE(phone, ' ', ''), '-', '') = ?)
                    LIMIT 1
                """, (identifier_clean, identifier_clean, identifier_clean, clean_phone))
                row = cur.fetchone()
                if row:
                    user_dict = dict(row)
                    user_dict["must_change_password"] = bool(user_dict.get("must_change_password", 0))
                    return user_dict
        except Exception as e:
            logger.error(f"Error querying user {identifier} from SQLite: {e}")

        # Fallback to in-memory cache
        if identifier_clean in self.deleted_users:
            return None
        for u in self.users:
            uid = str(u.get("id", "")).strip().lower()
            uemail = str(u.get("email", "")).strip().lower()
            uname = str(u.get("username", "")).strip().lower()
            uphone = str(u.get("phone", "")).replace(" ", "").replace("-", "")
            if (uemail == identifier_clean or uname == identifier_clean or uid == identifier_clean or (clean_phone and uphone == clean_phone)):
                return u
        return None

    def register_user(self, full_name: str, role: str, email: str, phone: str, username: str, password: str,
                      address: str = None, pharmacy_license: str = None, vehicle_type: str = None, 
                      driving_license: str = None, must_change_password: bool = False) -> dict:
        """Registers a user directly into SQLite database and syncs to memory & CSV mirror."""
        existing = self.find_user(email) or self.find_user(username) or (phone and self.find_user(phone))
        if existing:
            raise ValueError("An account with this email, username, or phone number already exists.")

        clean_email = email.strip().lower()
        clean_uname = (username or email.split("@")[0]).strip().lower()
        user_id = f"usr_{uuid.uuid4().hex[:8]}"
        created_at = datetime.now().isoformat() + "Z"
        must_change_val = 1 if must_change_password else 0

        with self.get_db() as conn:
            cur = conn.cursor()
            # Clear from tombstones if previously deleted
            cur.execute("DELETE FROM deleted_users WHERE LOWER(identifier) IN (?, ?) OR LOWER(email) = ? OR LOWER(username) = ?",
                        (clean_email, clean_uname, clean_email, clean_uname))
            
            cur.execute("""
                INSERT INTO users (
                    id, full_name, role, email, phone, username, password, status,
                    must_change_password, address, pharmacy_license, vehicle_type,
                    driving_license, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
            """, (
                user_id, full_name.strip(), role.strip(), email.strip(),
                phone.strip() if phone else "", clean_uname, password,
                must_change_val, address or "", pharmacy_license or "",
                vehicle_type or "", driving_license or "", created_at
            ))
            conn.commit()

        # Update in-memory state and CSV mirror
        self.load_users()
        new_user = self.find_user(user_id)
        logger.info(f"Registered user in SQLite: {clean_email} (Role: {role}, must_change_password: {must_change_password})")
        return new_user

    def validate_password_strength(self, password: str):
        if password in ["admin", "admin123"]:
            return
        if not password or len(password) < 8 or len(password) > 14:
            raise ValueError("Password must be between 8 and 14 characters in length.")
        if not re.search(r'[a-zA-Z]', password):
            raise ValueError("Password must contain at least one letter (a-z or A-Z).")
        if not re.search(r'\d', password):
            raise ValueError("Password must contain at least one numeric digit (0-9).")

    def create_pending_registration(self, full_name: str, role: str, email: str, phone: str, password: str, address: str = None) -> str:
        key = email.strip().lower()
        existing = self.find_user(email) or self.find_user(phone)
        if existing:
            raise ValueError("An account with this email address or phone number already exists.")

        self.validate_password_strength(password)

        otp_code = f"{random.randint(100000, 999999)}"
        username = email.split("@")[0]

        self.pending_registrations[key] = {
            "full_name": full_name,
            "role": role,
            "email": email,
            "phone": phone,
            "username": username,
            "password": password,
            "address": address or "",
            "otp": otp_code,
            "expires_at": time.time() + 300,
            "attempts": 0
        }
        logger.info(f"Created pending registration for {key} with 6-digit OTP (Expires in 300s)")
        return otp_code

    def confirm_pending_registration(self, email: str, otp_code: str) -> dict:
        """Verifies OTP and writes the verified user credentials into SQLite database."""
        key = email.strip().lower()
        pending = self.pending_registrations.get(key)
        if not pending:
            raise ValueError("No pending registration found for this email. Please fill the registration form again.")

        if time.time() > pending["expires_at"]:
            del self.pending_registrations[key]
            raise ValueError("The 6-digit verification OTP has expired. Please register again.")

        if pending["attempts"] >= 5:
            del self.pending_registrations[key]
            raise ValueError("Too many failed OTP attempts. Please register again.")

        if pending["otp"] != otp_code.strip():
            pending["attempts"] += 1
            remaining = 5 - pending["attempts"]
            raise ValueError(f"Invalid 6-digit OTP code. {remaining} attempt(s) remaining.")

        new_user = self.register_user(
            full_name=pending["full_name"],
            role=pending["role"],
            email=pending["email"],
            phone=pending["phone"],
            username=pending["username"],
            password=pending["password"],
            address=pending.get("address", ""),
            must_change_password=False
        )
        del self.pending_registrations[key]
        logger.info(f"Confirmed registration & saved user to SQLite: {new_user['full_name']} ({new_user['email']})")
        return new_user

    def update_password(self, identifier: str, new_password: str) -> bool:
        user = self.find_user(identifier)
        if not user:
            return False
        self.validate_password_strength(new_password)
        now_iso = datetime.now().isoformat() + "Z"
        with self.get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                UPDATE users 
                SET password = ?, updated_at = ?
                WHERE id = ?
            """, (new_password, now_iso, user["id"]))
            conn.commit()
        self.load_users()
        logger.info(f"Updated password in SQLite for user {user['email']}")
        return True

    def update_user_profile(self, identifier: str, data: dict) -> dict:
        user = self.find_user(identifier)
        if not user:
            raise ValueError(f"User not found for identifier: {identifier}")

        now_iso = datetime.now().isoformat() + "Z"
        full_name = (data.get("full_name") or data.get("name") or user.get("full_name") or "User").strip()
        phone = data.get("phone") if data.get("phone") is not None else user.get("phone", "")
        address = data.get("address") if data.get("address") is not None else user.get("address", "")
        allergies = data.get("allergies") if data.get("allergies") is not None else user.get("allergies", "")
        chronic_conditions = data.get("chronic_conditions") if data.get("chronic_conditions") is not None else user.get("chronic_conditions", "")
        rider_upi_id = data.get("rider_upi_id") if data.get("rider_upi_id") is not None else user.get("rider_upi_id", "")
        rider_upi_qr = data.get("rider_upi_qr") if data.get("rider_upi_qr") is not None else user.get("rider_upi_qr", "")
        shop_upi_id = data.get("shop_upi_id") if data.get("shop_upi_id") is not None else user.get("shop_upi_id", "")
        shop_upi_qr = data.get("shop_upi_qr") if data.get("shop_upi_qr") is not None else user.get("shop_upi_qr", "")

        new_password = data.get("password")
        if new_password and str(new_password).strip():
            self.validate_password_strength(str(new_password).strip())
            pwd_to_save = str(new_password).strip()
        else:
            pwd_to_save = user.get("password")

        with self.get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                UPDATE users
                SET full_name = ?, phone = ?, address = ?, allergies = ?,
                    chronic_conditions = ?, rider_upi_id = ?, rider_upi_qr = ?,
                    shop_upi_id = ?, shop_upi_qr = ?, password = ?, updated_at = ?
                WHERE id = ?
            """, (
                full_name, phone, address, allergies, chronic_conditions,
                rider_upi_id, rider_upi_qr, shop_upi_id, shop_upi_qr,
                pwd_to_save, now_iso, user["id"]
            ))
            conn.commit()

        self.load_users()
        updated = self.find_user(user["id"])
        logger.info(f"Updated profile details in SQLite for user {user['email']}")
        return updated

    def set_first_time_password(self, identifier: str, temp_password: str, new_password: str) -> dict:
        """Sets a permanent password for accounts initialized with a temporary password and clears must_change_password."""
        user = self.find_user(identifier)
        if not user:
            raise ValueError("User account not found.")

        if user.get("password") != temp_password.strip():
            raise ValueError("The temporary password entered is incorrect. Please verify your initial login credentials.")

        if new_password.strip() == temp_password.strip():
            raise ValueError("Your new password cannot be identical to the temporary password. Please choose a new, private password.")

        self.validate_password_strength(new_password)
        now_iso = datetime.now().isoformat() + "Z"
        with self.get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                UPDATE users 
                SET password = ?, must_change_password = 0, updated_at = ?
                WHERE id = ?
            """, (new_password.strip(), now_iso, user["id"]))
            conn.commit()

        self.load_users()
        updated_user = self.find_user(user["id"])
        logger.info(f"First-time password set for {updated_user['email']}! Temporary flag cleared.")
        return updated_user

    def load_deleted_partner_requests(self):
        """Loads tombstone records from SQLite into memory dictionary."""
        self.deleted_partner_requests = {}
        try:
            with self.get_db() as conn:
                cur = conn.cursor()
                cur.execute("SELECT * FROM deleted_partner_requests")
                for r in cur.fetchall():
                    self.deleted_partner_requests[r["id"].strip()] = dict(r)
        except Exception as e:
            logger.error(f"Error loading deleted partner requests from SQLite: {e}")

    def save_deleted_partner_requests(self):
        """Mirrors deleted partner request tombstones across JSON files for backup/visibility."""
        for d in self.get_all_dataset_dirs():
            path = os.path.join(d, 'deleted_partner_requests.json')
            try:
                with open(path, 'w', encoding='utf-8') as f:
                    json.dump(self.deleted_partner_requests, f, indent=2)
            except Exception as e:
                logger.error(f"Failed to mirror deleted partner requests to {path}: {e}")

    def load_partner_requests(self):
        """Loads partner requests from SQLite into memory and updates JSON mirror."""
        self.load_deleted_partner_requests()
        loaded = []
        try:
            with self.get_db() as conn:
                cur = conn.cursor()
                cur.execute("""
                    SELECT * FROM partner_requests
                    WHERE id NOT IN (SELECT id FROM deleted_partner_requests)
                    ORDER BY submitted_at DESC
                """)
                for r in cur.fetchall():
                    loaded.append(dict(r))
            self.partner_requests = loaded
            self.save_partner_requests()
            logger.info(f"Loaded {len(self.partner_requests)} active partner requests from SQLite.")
        except Exception as e:
            logger.error(f"Error querying partner requests from SQLite: {e}")

    def save_partner_requests(self):
        """Mirrors active partner requests to partner_requests.json for backup/visibility."""
        clean_requests = [
            r for r in self.partner_requests
            if r.get("id") and r.get("id") not in self.deleted_partner_requests
        ]
        for d in self.get_all_dataset_dirs():
            path = os.path.join(d, 'partner_requests.json')
            try:
                with open(path, 'w', encoding='utf-8') as f:
                    json.dump(clean_requests, f, indent=2)
            except Exception as e:
                logger.error(f"Error mirroring partner requests to {path}: {e}")

    def create_partner_request(self, partner_type: str, full_name: str, email: str, phone: str, details: dict) -> dict:
        req_id = f"req_{partner_type[:5]}_{uuid.uuid4().hex[:6]}"
        submitted_at = datetime.now().isoformat()
        new_req = {
            "id": req_id,
            "partner_type": partner_type,
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "status": "pending",
            "submitted_at": submitted_at,
            "store_name": details.get("store_name", ""),
            "license_no": details.get("license_no", ""),
            "store_address": details.get("store_address", ""),
            "latitude": float(details.get("latitude") or 19.0760),
            "longitude": float(details.get("longitude") or 72.8777),
            "vehicle_type": details.get("vehicle_type", ""),
            "driving_license": details.get("driving_license", ""),
            "vehicle_number": details.get("vehicle_number", ""),
            "delivery_zone": details.get("delivery_zone", ""),
            "shift_preference": details.get("shift_preference", ""),
            "rider_upi_id": details.get("rider_upi_id", ""),
            "rider_upi_qr": details.get("rider_upi_qr", ""),
            "shop_upi_id": details.get("shop_upi_id", ""),
            "shop_upi_qr": details.get("shop_upi_qr", "")
        }

        with self.get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO partner_requests (
                    id, partner_type, full_name, email, phone, status, submitted_at,
                    store_name, license_no, store_address, latitude, longitude,
                    vehicle_type, driving_license, vehicle_number, delivery_zone,
                    shift_preference, rider_upi_id, rider_upi_qr, shop_upi_id, shop_upi_qr
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                new_req["id"], new_req["partner_type"], new_req["full_name"], new_req["email"],
                new_req["phone"], new_req["status"], new_req["submitted_at"], new_req["store_name"],
                new_req["license_no"], new_req["store_address"], new_req["latitude"], new_req["longitude"],
                new_req["vehicle_type"], new_req["driving_license"], new_req["vehicle_number"],
                new_req["delivery_zone"], new_req["shift_preference"], new_req["rider_upi_id"],
                new_req["rider_upi_qr"], new_req["shop_upi_id"], new_req["shop_upi_qr"]
            ))
            conn.commit()

        self.load_partner_requests()
        logger.info(f"Created partner request in SQLite: {req_id} for {full_name} ({partner_type})")
        return new_req

    def get_partner_requests(self, status: str = None, partner_type: str = None) -> List[dict]:
        with self.get_db() as conn:
            cur = conn.cursor()
            query = """
                SELECT * FROM partner_requests
                WHERE id NOT IN (SELECT id FROM deleted_partner_requests)
            """
            params = []
            if status and status != 'all':
                query += " AND status = ?"
                params.append(status)
            if partner_type and partner_type != 'all':
                query += " AND partner_type = ?"
                params.append(partner_type)
            query += " ORDER BY submitted_at DESC"
            cur.execute(query, params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def delete_partner_request(self, req_id: str) -> bool:
        """Permanently removes a partner application from the onboarding KYC list."""
        now_iso = datetime.now().isoformat()
        with self.get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT OR REPLACE INTO deleted_partner_requests (id, action, timestamp)
                VALUES (?, 'removed', ?)
            """, (req_id, now_iso))
            conn.commit()

        self.load_deleted_partner_requests()
        self.load_partner_requests()
        logger.info(f"Recorded tombstone in SQLite for partner request {req_id} and removed from onboarding.")
        return True

    def approve_partner_request(self, req_id: str, fallback_data: Optional[dict] = None) -> dict:
        req = None
        with self.get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM partner_requests WHERE id = ?", (req_id,))
            row = cur.fetchone()
            if row:
                req = dict(row)
            elif fallback_data:
                req = dict(fallback_data)
                req["id"] = req_id
                # Insert into partner_requests table
                cur.execute("""
                    INSERT OR REPLACE INTO partner_requests (
                        id, partner_type, full_name, email, phone, status, submitted_at,
                        store_name, license_no, store_address, latitude, longitude,
                        vehicle_type, driving_license, vehicle_number, delivery_zone,
                        shift_preference, rider_upi_id, rider_upi_qr, shop_upi_id, shop_upi_qr
                    ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    req_id, req.get("partner_type", "pharmacy"), req.get("full_name", ""),
                    req.get("email", ""), req.get("phone", ""),
                    req.get("submitted_at", datetime.now().isoformat()),
                    req.get("store_name", ""), req.get("license_no", ""),
                    req.get("store_address", ""), float(req.get("latitude") or 19.0760),
                    float(req.get("longitude") or 72.8777), req.get("vehicle_type", ""),
                    req.get("driving_license", ""), req.get("vehicle_number", ""),
                    req.get("delivery_zone", ""), req.get("shift_preference", ""),
                    req.get("rider_upi_id", ""), req.get("rider_upi_qr", ""),
                    req.get("shop_upi_id", ""), req.get("shop_upi_qr", "")
                ))
                conn.commit()
            else:
                raise ValueError("Partner request not found.")

        role = "pharmacy" if req.get("partner_type") == "pharmacy" else "delivery"
        temp_pass = f"{role.capitalize()}123"
        raw_email = (req.get("email") or "").strip()
        raw_phone = (req.get("phone") or "").strip()
        base_username = raw_email.split("@")[0] if "@" in raw_email else (req.get("username") or f"user_{req_id[-4:]}")

        user = self.find_user(raw_email) or (raw_phone and self.find_user(raw_phone)) or self.find_user(base_username)
        if not user:
            clean_uname = base_username.strip().lower()
            # Ensure unique username
            with self.get_db() as conn:
                cur = conn.cursor()
                cur.execute("SELECT id FROM users WHERE LOWER(username) = ?", (clean_uname,))
                if cur.fetchone():
                    clean_uname = f"{clean_uname}_{uuid.uuid4().hex[:4]}"

            user_id = f"usr_{uuid.uuid4().hex[:8]}"
            created_at = datetime.now().isoformat() + "Z"
            with self.get_db() as conn:
                cur = conn.cursor()
                cur.execute("DELETE FROM deleted_users WHERE LOWER(identifier) IN (?, ?) OR LOWER(email) = ?",
                            (raw_email.lower(), clean_uname, raw_email.lower()))
                cur.execute("""
                    INSERT OR REPLACE INTO users (
                        id, full_name, role, email, phone, username, password, status,
                        must_change_password, address, pharmacy_license, vehicle_type,
                        driving_license, rider_upi_id, rider_upi_qr, shop_upi_id, shop_upi_qr, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    user_id, req.get("full_name", "").strip() or "Partner", role, raw_email,
                    raw_phone, clean_uname, temp_pass,
                    req.get("store_address", ""), req.get("license_no", ""),
                    req.get("vehicle_type", ""), req.get("driving_license", ""),
                    req.get("rider_upi_id", ""), req.get("rider_upi_qr", ""),
                    req.get("shop_upi_id", ""), req.get("shop_upi_qr", ""), created_at
                ))
                conn.commit()
            self.load_users()
            user = self.find_user(user_id) or self.find_user(raw_email) or {
                "id": user_id, "full_name": req.get("full_name", "Partner"), "role": role,
                "email": raw_email, "phone": raw_phone, "username": clean_uname, "status": "active"
            }
        else:
            with self.get_db() as conn:
                cur = conn.cursor()
                cur.execute("""
                    UPDATE users 
                    SET role = ?, status = 'active', password = ?, must_change_password = 1,
                        address = COALESCE(NULLIF(?, ''), address),
                        pharmacy_license = COALESCE(NULLIF(?, ''), pharmacy_license),
                        vehicle_type = COALESCE(NULLIF(?, ''), vehicle_type),
                        driving_license = COALESCE(NULLIF(?, ''), driving_license),
                        rider_upi_id = COALESCE(NULLIF(?, ''), rider_upi_id),
                        rider_upi_qr = COALESCE(NULLIF(?, ''), rider_upi_qr),
                        shop_upi_id = COALESCE(NULLIF(?, ''), shop_upi_id),
                        shop_upi_qr = COALESCE(NULLIF(?, ''), shop_upi_qr),
                        updated_at = ?
                    WHERE id = ? OR LOWER(email) = ?
                """, (
                    role, temp_pass,
                    req.get("store_address", ""), req.get("license_no", ""),
                    req.get("vehicle_type", ""), req.get("driving_license", ""),
                    req.get("rider_upi_id", ""), req.get("rider_upi_qr", ""),
                    req.get("shop_upi_id", ""), req.get("shop_upi_qr", ""),
                    datetime.now().isoformat() + "Z", user["id"], raw_email.lower()
                ))
                conn.commit()
            self.load_users()
            user = self.find_user(user["id"]) or user

        if req.get("partner_type") == "pharmacy":
            pharm_id = f"PHARM_{req_id[-4:].upper()}"
            store_name = req.get("store_name") or req.get("full_name") or "Express Pharmacy"
            lat = float(req.get("latitude") or 19.0760)
            lng = float(req.get("longitude") or 72.8777)
            
            self.pharmacy_metadata[pharm_id] = {
                "id": pharm_id,
                "name": store_name,
                "tagline": "⚡ 10-15 Min Partner Dark-Store",
                "address": req.get("store_address") or "Registered Pharmacy Location",
                "latitude": lat,
                "longitude": lng,
                "phone": req.get("phone", "+91 824 000 0000"),
                "rating": 4.9,
                "is_open": True,
                "instant_eligible": True,
                "shop_upi_id": req.get("shop_upi_id") or f"{store_name.lower().replace(' ', '')}@upi",
                "shop_upi_qr": req.get("shop_upi_qr") or f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa={req.get('shop_upi_id', 'express.pharmacy@upi')}%26pn={store_name}%26cu=INR",
                "live_terminal_qr": None,
                "terminal_label": "Counter POS Terminal"
            }
            logger.info(f"Registered new GPS dark-store pharmacy node: {store_name} ({pharm_id}) at [{lat}, {lng}]")

        now_iso = datetime.now().isoformat()
        with self.get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                UPDATE partner_requests 
                SET status = 'approved', approved_at = ?, temp_password = ?
                WHERE id = ?
            """, (now_iso, temp_pass, req_id))
            cur.execute("""
                INSERT OR REPLACE INTO deleted_partner_requests (id, action, timestamp, email)
                VALUES (?, 'approved', ?, ?)
            """, (req_id, now_iso, raw_email))
            conn.commit()

        self.load_deleted_partner_requests()
        self.load_partner_requests()
        req["status"] = "approved"
        req["approved_at"] = now_iso
        req["temp_password"] = temp_pass
        logger.info(f"Approved partner request {req_id}. User: {user['email']}, must_change_password=True")
        return {"request": req, "user": user, "temp_password": temp_pass}

    def reject_partner_request(self, req_id: str, reason: str = "Application credentials could not be verified.", fallback_data: Optional[dict] = None) -> dict:
        req = None
        with self.get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM partner_requests WHERE id = ?", (req_id,))
            row = cur.fetchone()
            if row:
                req = dict(row)
            elif fallback_data:
                req = dict(fallback_data)
                req["id"] = req_id
                cur.execute("""
                    INSERT OR IGNORE INTO partner_requests (
                        id, partner_type, full_name, email, phone, status, submitted_at,
                        store_name, license_no, store_address, latitude, longitude
                    ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
                """, (
                    req_id, req.get("partner_type", "pharmacy"), req.get("full_name", ""),
                    req.get("email", ""), req.get("phone", ""),
                    req.get("submitted_at", datetime.now().isoformat()),
                    req.get("store_name", ""), req.get("license_no", ""),
                    req.get("store_address", ""), float(req.get("latitude") or 19.0760),
                    float(req.get("longitude") or 72.8777)
                ))
            else:
                raise ValueError("Partner request not found.")

        now_iso = datetime.now().isoformat()
        with self.get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                UPDATE partner_requests 
                SET status = 'rejected', rejected_at = ?, rejection_reason = ?
                WHERE id = ?
            """, (now_iso, reason, req_id))
            cur.execute("""
                INSERT OR REPLACE INTO deleted_partner_requests (id, action, reason, timestamp, email)
                VALUES (?, 'rejected', ?, ?, ?)
            """, (req_id, reason, now_iso, req.get("email", "")))
            conn.commit()

        self.load_deleted_partner_requests()
        self.load_partner_requests()
        req["status"] = "rejected"
        req["rejected_at"] = now_iso
        req["rejection_reason"] = reason
        logger.info(f"Rejected partner request {req_id} in SQLite. Reason: {reason}")
        return req

    def get_pharmacy_full_catalog(self, pharmacy_id: str = "PHARM_001") -> List[dict]:
        """
        Returns all medicines available in the database, with stock status and quantities for the given pharmacy.
        """
        pharm_stock = {}
        for inv in self.inventory:
            if inv.get("pharmacy_id") == pharmacy_id:
                mid = inv.get("medicine_id")
                qty = int(inv.get("quantity_available", 0) or 0)
                pharm_stock[mid] = qty

        catalog = []
        for mid, med in self.medicines.items():
            qty = pharm_stock.get(mid, 0)
            in_stock = qty > 0
            catalog.append({
                "medicine_id": mid,
                "brand_name": med.get("brand_name", mid),
                "generic_name": med.get("generic_name", "N/A"),
                "category": med.get("category", "General"),
                "dosage": med.get("dosage", "Standard"),
                "form": med.get("form", "Tablet"),
                "manufacturer": med.get("manufacturer", "Generic Labs"),
                "price_mrp": med.get("price_mrp", "45.00"),
                "in_stock": in_stock,
                "quantity": qty
            })
        catalog.sort(key=lambda m: m["brand_name"].lower())
        return catalog

    def bulk_update_pharmacy_inventory(self, pharmacy_id: str, updates: dict) -> dict:
        """
        Updates in_stock status and quantities for medicines in pharmacy's inventory.
        updates format: { medicine_id: {"in_stock": bool, "quantity": int} }
        """
        inv_map = {}
        for inv in self.inventory:
            if inv.get("pharmacy_id") == pharmacy_id:
                inv_map[inv.get("medicine_id")] = inv

        updated_count = 0
        for mid, item in updates.items():
            is_stock = item.get("in_stock", True)
            qty = int(item.get("quantity", 50) if is_stock else 0)
            if mid in inv_map:
                inv_map[mid]["quantity_available"] = qty
                updated_count += 1
            else:
                new_inv = {
                    "pharmacy_id": pharmacy_id,
                    "medicine_id": mid,
                    "quantity_available": qty,
                    "price_mrp": self.medicines.get(mid, {}).get("price_mrp", "50.00"),
                    "expiry_date": "2028-12-31"
                }
                self.inventory.append(new_inv)
                if mid not in self.inventory_by_med:
                    self.inventory_by_med[mid] = []
                self.inventory_by_med[mid].append(new_inv)
                updated_count += 1

        logger.info(f"Updated inventory for {pharmacy_id}: {updated_count} medicines modified.")
        return {
            "status": "success",
            "message": f"Successfully updated stock status for {updated_count} medicines!",
            "updated_count": updated_count
        }

    def generate_otp(self, identifier: str) -> str:
        key = identifier.strip().lower()
        otp_code = f"{random.randint(100000, 999999)}"
        self.otps[key] = {
            "code": otp_code,
            "expires_at": time.time() + 300,
            "attempts": 0
        }
        logger.info(f"Generated secure OTP {otp_code} for {key} (Expires in 300s)")
        return otp_code

    def verify_otp(self, identifier: str, otp_code: str) -> Tuple[bool, str]:
        key = identifier.strip().lower()
        record = self.otps.get(key)
        if not record:
            return False, "No OTP request found for this identifier. Please click Request OTP."
        
        if time.time() > record["expires_at"]:
            del self.otps[key]
            return False, "The OTP code has expired (valid for 5 minutes). Please request a new OTP."
            
        if record["attempts"] >= 5:
            del self.otps[key]
            return False, "Too many failed attempts. Please request a new OTP."
            
        if record["code"] != otp_code.strip():
            record["attempts"] += 1
            remaining = 5 - record["attempts"]
            return False, f"Invalid 6-digit OTP code. {remaining} attempt(s) remaining."
            
        del self.otps[key]
        return True, "Verification successful"

    # ─── ADMIN USER ACCOUNT MANAGEMENT ───
    def get_all_users(self) -> List[dict]:
        """Returns all registered users from SQLite with sanitized fields, excluding permanently deleted accounts."""
        try:
            with self.get_db() as conn:
                cur = conn.cursor()
                cur.execute("""
                    SELECT id, full_name, role, email, phone, username, status,
                           must_change_password, address, pharmacy_license, vehicle_type,
                           driving_license, created_at, updated_at
                    FROM users
                    WHERE LOWER(id) NOT IN (SELECT LOWER(identifier) FROM deleted_users)
                      AND LOWER(email) NOT IN (SELECT LOWER(identifier) FROM deleted_users)
                      AND LOWER(username) NOT IN (SELECT LOWER(identifier) FROM deleted_users)
                    ORDER BY created_at DESC
                """)
                rows = cur.fetchall()
                sanitized = []
                for r in rows:
                    u = dict(r)
                    u["must_change_password"] = bool(u.get("must_change_password", 0))
                    sanitized.append(u)
                return sanitized
        except Exception as e:
            logger.error(f"Error querying all users from SQLite: {e}")

        # Fallback to in-memory list
        sanitized = []
        for u in self.users:
            uid = str(u.get("id", "")).strip().lower()
            uemail = str(u.get("email", "")).strip().lower()
            uname = str(u.get("username", "")).strip().lower()
            if uid in self.deleted_users or uemail in self.deleted_users or uname in self.deleted_users:
                continue
            sanitized.append({
                "id": u.get("id"),
                "full_name": u.get("full_name"),
                "role": u.get("role", "patient"),
                "email": u.get("email"),
                "phone": u.get("phone"),
                "username": u.get("username"),
                "status": u.get("status", "active"),
                "must_change_password": bool(u.get("must_change_password", False)),
                "address": u.get("address", ""),
                "pharmacy_license": u.get("pharmacy_license", ""),
                "vehicle_type": u.get("vehicle_type", ""),
                "driving_license": u.get("driving_license", ""),
                "created_at": u.get("created_at", "")
            })
        return sanitized

    def set_user_status(self, user_id: str, status: str) -> dict:
        """Toggles user account status between 'active' and 'deactivated' directly in SQLite."""
        clean_id = user_id.strip().lower()
        clean_status = status.strip().lower()
        if clean_status not in ["active", "deactivated"]:
            clean_status = "active"

        user = self.find_user(clean_id)
        if not user:
            raise ValueError(f"User account '{user_id}' not found.")

        if user.get("role") == "admin":
            raise ValueError("Cannot deactivate the master system administrator account.")

        now_iso = datetime.now().isoformat() + "Z"
        with self.get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                UPDATE users
                SET status = ?, updated_at = ?
                WHERE id = ? OR LOWER(email) = ? OR LOWER(username) = ?
            """, (clean_status, now_iso, clean_id, clean_id, clean_id))
            conn.commit()

        self.load_users()
        updated = self.find_user(user["id"])
        logger.info(f"Updated status of user {updated['email']} to {clean_status} in SQLite.")
        return updated

    def delete_user_account(self, user_id: str) -> bool:
        """Removes a user account permanently from SQLite and records a persistent tombstone."""
        clean_id = user_id.strip().lower()
        target_user = self.find_user(clean_id)
        if not target_user:
            with self.get_db() as conn:
                cur = conn.cursor()
                cur.execute("SELECT identifier FROM deleted_users WHERE LOWER(identifier) = ?", (clean_id,))
                if cur.fetchone():
                    return True
            raise ValueError(f"User account '{user_id}' not found.")

        if target_user.get("role") == "admin":
            raise ValueError("Cannot delete the master system administrator account.")

        del_at = datetime.now().isoformat() + "Z"
        with self.get_db() as conn:
            cur = conn.cursor()
            for ident in [target_user.get("id"), target_user.get("email"), target_user.get("username")]:
                if ident:
                    cur.execute("""
                        INSERT OR REPLACE INTO deleted_users (identifier, id, email, username, role, deleted_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (str(ident).strip().lower(), target_user.get("id"), target_user.get("email"), target_user.get("username"), target_user.get("role"), del_at))

            cur.execute("DELETE FROM users WHERE id = ? OR LOWER(email) = ? OR LOWER(username) = ?",
                        (clean_id, clean_id, clean_id))
            if target_user.get("email"):
                cur.execute("DELETE FROM partner_requests WHERE LOWER(email) = ?", (target_user["email"].lower(),))
            conn.commit()

        self.load_deleted_users()
        self.load_users()
        self.save_deleted_users()
        logger.info(f"Permanently deleted user account {target_user['email']} from SQLite with tombstones recorded.")
        return True

    # ─── ESSENTIAL CHEMICAL COMPOUNDS INVENTORY SETUP (QUIZ) ───
    def get_essential_compounds(self) -> List[dict]:
        """Returns the curated inventory setup list of generic chemical compounds for retail pharmacies."""
        return ESSENTIAL_CHEMICAL_COMPOUNDS

    def bulk_sync_compound_inventory(self, pharmacy_id: str, compound_selections: dict) -> dict:
        """
        Takes pharmacy quiz answers (compound_name -> in_stock: True/False)
        and populates the pharmacy's real inventory with appropriate therapeutic molecules.
        """
        synced_count = 0
        comp_map = {c["compound_name"]: c for c in ESSENTIAL_CHEMICAL_COMPOUNDS}

        for comp_name, is_in_stock in compound_selections.items():
            if not is_in_stock:
                continue

            comp_meta = comp_map.get(comp_name)
            default_qty = comp_meta["default_stock"] if comp_meta else 80
            brand_example = comp_meta["brand_examples"].split(",")[0].strip() if comp_meta else comp_name
            price = comp_meta["default_price"] if comp_meta else "75.00"

            # Sync into pharmacy inventory
            self.sync_inventory(
                pharmacy_id=pharmacy_id,
                medicine_name=f"{brand_example} ({comp_name})",
                generic=comp_name,
                quantity=default_qty,
                expiry="2028-12-31",
                manufacturer="MEDORA Verified Labs"
            )
            synced_count += 1

        logger.info(f"Pharmacy {pharmacy_id} synced {synced_count} chemical compounds via inventory onboarding quiz.")
        return {
            "status": "success",
            "pharmacy_id": pharmacy_id,
            "compounds_synced": synced_count,
            "message": f"Successfully synced {synced_count} active chemical compounds to {pharmacy_id} store inventory!"
        }

    # ─── MISSING MEDICINE SEARCH BROADCAST & PHARMACY NOTIFICATION DROPDOWN ───
    def log_missing_medicine(self, query: str, medicine_name: str, compound_name: str, user_lat: float = 19.0760, user_lng: float = 72.8777, user_id: str = "guest") -> dict:
        """
        Logs a patient search for a medicine with zero stock across connected pharmacies.
        Broadcasts as a real-time inquiry to all active pharmacy stores.
        """
        clean_name = medicine_name.strip()
        # Avoid duplicate requests in last 5 minutes for the exact same query
        now = time.time()
        for r in self.missing_medicine_requests:
            if r["medicine_name"].lower() == clean_name.lower():
                # Already active
                r["last_searched_timestamp"] = datetime.now().isoformat()
                r["search_count"] = r.get("search_count", 1) + 1
                return r

        req_id = f"MISS_{uuid.uuid4().hex[:6].upper()}"
        new_req = {
            "id": req_id,
            "query": query,
            "medicine_name": clean_name,
            "compound_name": compound_name or clean_name,
            "user_id": user_id,
            "user_lat": user_lat,
            "user_lng": user_lng,
            "timestamp": datetime.now().isoformat(),
            "last_searched_timestamp": datetime.now().isoformat(),
            "search_count": 1,
            "status": "pending", # "pending" | "resolved"
            "responses": {} # pharmacy_id: {"action": "ignored"|"in_stock"|"dismissed", "time": ...}
        }
        self.missing_medicine_requests.insert(0, new_req)
        # Cap to 50 active inquiries
        if len(self.missing_medicine_requests) > 50:
            self.missing_medicine_requests = self.missing_medicine_requests[:50]
        logger.info(f"Broadcasted missing medicine alert: {clean_name} (Compound: {compound_name})")
        return new_req

    def get_missing_medicine_feed(self, pharmacy_id: str) -> dict:
        """
        Returns active missing medicine inquiries for the given pharmacy.
        Distinguishes between:
        - urgent_alerts (status == 'pending' for this pharmacy)
        - ignored_requests (status == 'ignored' for this pharmacy, to show in notification bell dropdown)
        """
        urgent = []
        ignored = []

        for req in self.missing_medicine_requests:
            resp = req.get("responses", {}).get(pharmacy_id, {})
            action = resp.get("action", "pending")

            item = {
                "id": req["id"],
                "query": req["query"],
                "medicine_name": req["medicine_name"],
                "compound_name": req.get("compound_name", req["medicine_name"]),
                "timestamp": req["timestamp"],
                "search_count": req.get("search_count", 1),
                "pharmacy_status": action
            }

            if action == "pending":
                urgent.append(item)
            elif action == "ignored":
                ignored.append(item)

        return {
            "pharmacy_id": pharmacy_id,
            "urgent_alerts": urgent,
            "ignored_requests": ignored,
            "total_pending": len(urgent),
            "total_ignored": len(ignored)
        }

    def respond_to_missing_medicine(self, request_id: str, pharmacy_id: str, action: str, quantity: int = 50, price: str = "85.00") -> dict:
        """
        Handles pharmacy response to a missing medicine inquiry:
        - 'in_stock': Instantly stocks medicine in pharmacy inventory and resolves the inquiry.
        - 'ignore': Moves from urgent popup to the pharmacy header notification dropdown.
        - 'dismiss': Permanently removes from the ignored dropdown.
        """
        req = next((r for r in self.missing_medicine_requests if r["id"] == request_id), None)
        if not req:
            raise ValueError(f"Missing medicine request {request_id} not found.")

        if "responses" not in req:
            req["responses"] = {}

        now_str = datetime.now().isoformat()

        if action == "in_stock":
            # Add to pharmacy stock
            self.sync_inventory(
                pharmacy_id=pharmacy_id,
                medicine_name=req["medicine_name"],
                generic=req.get("compound_name", req["medicine_name"]),
                quantity=quantity,
                expiry="2028-12-31",
                manufacturer="Local Store Stock"
            )
            req["responses"][pharmacy_id] = {
                "action": "in_stock",
                "quantity": quantity,
                "price": price,
                "timestamp": now_str
            }
            req["status"] = "resolved"
            logger.info(f"Pharmacy {pharmacy_id} marked missing medicine {req['medicine_name']} IN STOCK (+{quantity})")
            return {
                "status": "success",
                "action": "in_stock",
                "message": f"Successfully added {quantity} units of {req['medicine_name']} to your inventory!",
                "request": req
            }

        elif action == "ignore":
            req["responses"][pharmacy_id] = {
                "action": "ignored",
                "timestamp": now_str
            }
            logger.info(f"Pharmacy {pharmacy_id} ignored missing medicine popup for {req['medicine_name']}. Moved to notification dropdown.")
            return {
                "status": "success",
                "action": "ignored",
                "message": f"Moved to notification menu. You can review and stock {req['medicine_name']} anytime from the bell icon.",
                "request": req
            }

        elif action == "dismiss":
            req["responses"][pharmacy_id] = {
                "action": "dismissed",
                "timestamp": now_str
            }
            logger.info(f"Pharmacy {pharmacy_id} dismissed missing medicine inquiry for {req['medicine_name']}.")
            return {
                "status": "success",
                "action": "dismissed",
                "message": f"Dismissed inquiry for {req['medicine_name']}.",
                "request": req
            }
        else:
            raise ValueError(f"Unsupported action '{action}'. Must be 'in_stock', 'ignore', or 'dismiss'.")

# ─── CURATED ESSENTIAL CHEMICAL COMPOUNDS ───
ESSENTIAL_CHEMICAL_COMPOUNDS = [
    {
        "id": "COMP_001",
        "compound_name": "Paracetamol (Acetaminophen)",
        "brand_examples": "Crocin, Dolo 650, Calpol, Pacimol",
        "category": "Antipyretic & Analgesic",
        "standard_strength": "500mg / 650mg",
        "form": "Tablet / Syrup",
        "description": "First-line antipyretic for fever reduction and mild-to-moderate pain management.",
        "common_indication": "Fever, Headache, Body Aches",
        "default_stock": 100,
        "default_price": "32.00"
    },
    {
        "id": "COMP_002",
        "compound_name": "Amoxicillin + Potassium Clavulanate",
        "brand_examples": "Augmentin 625, Amoxyclav, Clavam",
        "category": "Broad-Spectrum Antibiotic",
        "standard_strength": "625mg (500mg+125mg)",
        "form": "Tablet",
        "description": "Beta-lactamase inhibitor combination antibiotic for bacterial respiratory & ENT infections.",
        "common_indication": "Bacterial Sinusitis, Bronchitis, RTI",
        "default_stock": 60,
        "default_price": "220.00"
    },
    {
        "id": "COMP_003",
        "compound_name": "Pantoprazole Sodium",
        "brand_examples": "Pan 40, Pantocid, Pantodac",
        "category": "Gastrointestinal / Antacid",
        "standard_strength": "40mg",
        "form": "Delayed-Release Tablet",
        "description": "Proton Pump Inhibitor (PPI) that decreases stomach acid secretion for heartburn and GERD.",
        "common_indication": "Acid Reflux, Heartburn, Gastric Erosion",
        "default_stock": 80,
        "default_price": "145.00"
    },
    {
        "id": "COMP_004",
        "compound_name": "Metformin Hydrochloride",
        "brand_examples": "Glycomet, Glucophage, Obimet",
        "category": "Oral Antidiabetic",
        "standard_strength": "500mg / 850mg / 1000mg SR",
        "form": "Sustained-Release Tablet",
        "description": "Gold standard biguanide oral antihyperglycemic for glycemic control in Type 2 Diabetes.",
        "common_indication": "Type 2 Diabetes Mellitus",
        "default_stock": 90,
        "default_price": "55.00"
    },
    {
        "id": "COMP_005",
        "compound_name": "Cetirizine Dihydrochloride",
        "brand_examples": "Cetzine, Alerid, Zyrtec",
        "category": "Antihistamine & Anti-Allergy",
        "standard_strength": "10mg",
        "form": "Tablet",
        "description": "Second-generation H1 antagonist for allergic rhinitis, sneezing, and pruritus without heavy sedation.",
        "common_indication": "Seasonal Allergies, Allergic Rhinitis, Hives",
        "default_stock": 100,
        "default_price": "28.00"
    },
    {
        "id": "COMP_006",
        "compound_name": "Azithromycin",
        "brand_examples": "Azithral 500, Azee 500, Zithrox",
        "category": "Macrolide Antibiotic",
        "standard_strength": "500mg",
        "form": "Tablet",
        "description": "Macrolide antibiotic active against atypical respiratory pathogens, pharyngitis, and skin infections.",
        "common_indication": "Pharyngitis, Tonsillitis, Chest Infections",
        "default_stock": 50,
        "default_price": "130.00"
    },
    {
        "id": "COMP_007",
        "compound_name": "Omeprazole",
        "brand_examples": "Omez 20, Omecip, Ocid",
        "category": "Gastrointestinal / Antacid",
        "standard_strength": "20mg",
        "form": "Capsule",
        "description": "Proton pump inhibitor treating peptic ulcers, acid reflux, and NSAID-induced dyspepsia.",
        "common_indication": "Hyperacidity, Peptic Ulcers, Heartburn",
        "default_stock": 70,
        "default_price": "60.00"
    },
    {
        "id": "COMP_008",
        "compound_name": "Atorvastatin Calcium",
        "brand_examples": "Atorva, Lipitor, Storvas",
        "category": "Cardiovascular / Statin",
        "standard_strength": "10mg / 20mg",
        "form": "Tablet",
        "description": "HMG-CoA reductase inhibitor for dyslipidemia and cardiovascular risk reduction.",
        "common_indication": "High Cholesterol, Atherosclerosis",
        "default_stock": 60,
        "default_price": "180.00"
    },
    {
        "id": "COMP_009",
        "compound_name": "Ibuprofen + Paracetamol",
        "brand_examples": "Combiflam, Flexon, Ibugesic Plus",
        "category": "NSAID & Analgesic Combination",
        "standard_strength": "400mg + 325mg",
        "form": "Tablet",
        "description": "Synergistic anti-inflammatory and painkiller for dental, joint, muscular pain and headache.",
        "common_indication": "Toothache, Musculoskeletal Pain, Sprains",
        "default_stock": 80,
        "default_price": "48.00"
    },
    {
        "id": "COMP_010",
        "compound_name": "Telmisartan",
        "brand_examples": "Telma 40, Telpres, Targit",
        "category": "Cardiovascular / Antihypertensive",
        "standard_strength": "40mg",
        "form": "Tablet",
        "description": "Angiotensin II Receptor Blocker (ARB) providing smooth 24-hour blood pressure control.",
        "common_indication": "Essential Hypertension, High BP",
        "default_stock": 75,
        "default_price": "110.00"
    },
    {
        "id": "COMP_011",
        "compound_name": "Montelukast Sodium + Levocetirizine",
        "brand_examples": "Montair-LC, Telekast-L, Montek-LC",
        "category": "Respiratory & Anti-Allergy",
        "standard_strength": "10mg + 5mg",
        "form": "Tablet",
        "description": "Leukotriene receptor blocker plus antihistamine for severe allergic rhinitis & bronchial asthma prophylaxis.",
        "common_indication": "Allergic Asthma, Chronic Rhinitis, Wheezing",
        "default_stock": 65,
        "default_price": "195.00"
    },
    {
        "id": "COMP_012",
        "compound_name": "Amlodipine Besylate",
        "brand_examples": "Amlong 5, Stamlo 5, Norvasc",
        "category": "Cardiovascular / CCB",
        "standard_strength": "5mg",
        "form": "Tablet",
        "description": "Dihydropyridine calcium channel blocker for vasodilation and arterial blood pressure lowering.",
        "common_indication": "Hypertension, Chronic Stable Angina",
        "default_stock": 70,
        "default_price": "42.00"
    },
    {
        "id": "COMP_013",
        "compound_name": "Domperidone + Pantoprazole",
        "brand_examples": "Pan-D, Pantocid-D, Dompan",
        "category": "Gastrointestinal Prokinetic",
        "standard_strength": "30mg SR + 40mg",
        "form": "Capsule",
        "description": "Dopamine D2 receptor antagonist combined with PPI for nausea, gastric reflux, and fullness.",
        "common_indication": "GERD with Nausea, Dyspepsia, Vomiting",
        "default_stock": 80,
        "default_price": "180.00"
    },
    {
        "id": "COMP_014",
        "compound_name": "Ciprofloxacin Hydrochloride",
        "brand_examples": "Ciplox 500, Cifran 500, Ciprobid",
        "category": "Fluoroquinolone Antibiotic",
        "standard_strength": "500mg",
        "form": "Tablet",
        "description": "Broad-spectrum bactericidal fluoroquinolone for gastrointestinal and urinary tract infections.",
        "common_indication": "Bacterial Diarrhea, Urinary Tract Infection (UTI)",
        "default_stock": 50,
        "default_price": "52.00"
    },
    {
        "id": "COMP_015",
        "compound_name": "Salbutamol (Albuterol) Inhaler",
        "brand_examples": "Asthalin Inhaler, Ventorlin, Aerocort",
        "category": "Respiratory / Bronchodilator",
        "standard_strength": "100mcg / puff",
        "form": "Pressurized Metered Dose Inhaler",
        "description": "Fast-acting beta-2 adrenergic agonist providing immediate bronchodilation in acute asthma episodes.",
        "common_indication": "Acute Bronchospasm, Asthma Attack, COPD",
        "default_stock": 40,
        "default_price": "165.00"
    },
    {
        "id": "COMP_016",
        "compound_name": "Diclofenac Sodium Gel / Tablets",
        "brand_examples": "Voveran Emulgel, Volini, Dynapar",
        "category": "Topical & Oral NSAID",
        "standard_strength": "1% Gel / 50mg Tablet",
        "form": "Gel / Tablet",
        "description": "COX inhibitor targeting localized joint inflammation, osteoarthritis, back pain, and sports sprains.",
        "common_indication": "Arthritis, Joint Swelling, Muscular Sprain",
        "default_stock": 60,
        "default_price": "95.00"
    },
    {
        "id": "COMP_017",
        "compound_name": "Ranitidine / Famotidine",
        "brand_examples": "Aciloc 150, Rantac 150, Famocid",
        "category": "H2 Receptor Antagonist",
        "standard_strength": "150mg / 20mg",
        "form": "Tablet",
        "description": "Rapid gastric acid suppressor for acute heartburn, acid indigestion, and sour belching.",
        "common_indication": "Sour Stomach, Acid Indigestion, Gastric Distress",
        "default_stock": 90,
        "default_price": "38.00"
    },
    {
        "id": "COMP_018",
        "compound_name": "Glimepiride",
        "brand_examples": "Amaryl 1mg/2mg, Glimestar, GP 1",
        "category": "Sulfonylurea Antidiabetic",
        "standard_strength": "1mg / 2mg",
        "form": "Tablet",
        "description": "Stimulates pancreatic beta-cells to secrete insulin for postprandial glucose control.",
        "common_indication": "Type 2 Diabetes Mellitus",
        "default_stock": 50,
        "default_price": "85.00"
    },
    {
        "id": "COMP_019",
        "compound_name": "Oral Rehydration Salts (ORS)",
        "brand_examples": "Electral Powder, Prolyte ORS, Enerzal",
        "category": "Electrolyte Restorer",
        "standard_strength": "WHO Formula Sachet (21.8g)",
        "form": "Oral Sachet Powder",
        "description": "Balanced formulation of sodium chloride, potassium chloride, sodium citrate, and anhydrous dextrose.",
        "common_indication": "Dehydration, Heat Exhaustion, Diarrhea",
        "default_stock": 150,
        "default_price": "22.50"
    },
    {
        "id": "COMP_020",
        "compound_name": "Dextromethorphan + Chlorpheniramine",
        "brand_examples": "Ascoril-D, Benadryl DR, Chericof",
        "category": "Antitussive Cough Formula",
        "standard_strength": "10mg + 2mg per 5ml",
        "form": "Syrup",
        "description": "Centrally acting non-opioid cough suppressant combined with antihistamine for non-productive dry cough.",
        "common_indication": "Dry Irritating Cough, Throat Tickle",
        "default_stock": 60,
        "default_price": "115.00"
    },
    {
        "id": "COMP_021",
        "compound_name": "Loperamide Hydrochloride",
        "brand_examples": "Imodium, Eldoper, Lopamide",
        "category": "Antimotility Antidiarrheal",
        "standard_strength": "2mg",
        "form": "Capsule",
        "description": "Slows intestinal transit time and reduces stool volume in acute non-infectious diarrhea.",
        "common_indication": "Acute Traveler's Diarrhea, Loose Stools",
        "default_stock": 80,
        "default_price": "35.00"
    },
    {
        "id": "COMP_022",
        "compound_name": "Clotrimazole Topical / Dusting Powder",
        "brand_examples": "Candid Dusting Powder, Canesten, Clocip",
        "category": "Topical Antifungal",
        "standard_strength": "1% w/w",
        "form": "Dusting Powder / Cream",
        "description": "Ergosterol biosynthesis inhibitor fighting fungal skin infections, prickly heat, and sweat rash.",
        "common_indication": "Fungal Skin Infection, Ringworm, Jock Itch",
        "default_stock": 70,
        "default_price": "110.00"
    },
    {
        "id": "COMP_023",
        "compound_name": "Ferrous Ascorbate + Folic Acid",
        "brand_examples": "Orofer XT, Livogen, Imax XT",
        "category": "Hematinic & Nutritional Supplement",
        "standard_strength": "100mg Elemental Iron + 1.5mg Folic Acid",
        "form": "Tablet",
        "description": "Highly absorbable synthetic iron and folate replenishment to treat iron deficiency anemia.",
        "common_indication": "Anemia, Fatigue, Pregnancy Nutritional Support",
        "default_stock": 60,
        "default_price": "190.00"
    },
    {
        "id": "COMP_024",
        "compound_name": "Ascorbic Acid (Vitamin C) + Zinc",
        "brand_examples": "Limcee, Celin 500, Zinconia",
        "category": "Antioxidant & Immune Support",
        "standard_strength": "500mg + 50mg",
        "form": "Chewable Tablet",
        "description": "Essential water-soluble micronutrients that accelerate wound healing, collagen synthesis, and immune resistance.",
        "common_indication": "Immune Defense, Viral Recovery, Vitamin C Deficiency",
        "default_stock": 100,
        "default_price": "45.00"
    }
]

global_datastore = None

def get_datastore() -> PrototypeDataStore:
    global global_datastore
    if not global_datastore:
        global_datastore = PrototypeDataStore()
    return global_datastore
