import pg from "pg";

const { Pool } = pg;

const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) throw new Error("No DB URL found");

const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.default.hash(password, 10);
}

async function seed() {
  const client = await pool.connect();
  console.log("Connected to database. Seeding...");

  try {
    const adminHash = await hashPassword("admin123");
    await client.query(`
      INSERT INTO users (username, password, role, name, email)
      VALUES ('admin', $1, 'admin', 'School Administrator', 'admin@kips.edu.pk')
      ON CONFLICT (username) DO UPDATE SET password = $1
    `, [adminHash]);
    console.log("✓ Admin user (admin / admin123)");

    const existingClasses = await client.query("SELECT count(*) as cnt FROM classes");
    if (Number(existingClasses.rows[0].cnt) === 0) {
      await client.query(`
        INSERT INTO classes (name, grade, sections) VALUES
          ('Nursery', 'Nursery', 'A,B'),
          ('KG',      'KG',      'A,B'),
          ('Prep',    'Prep',    'A,B'),
          ('Class 1', 'Grade 1', 'A,B'),
          ('Class 2', 'Grade 2', 'A,B'),
          ('Class 3', 'Grade 3', 'A,B'),
          ('Class 4', 'Grade 4', 'A,B'),
          ('Class 5', 'Grade 5', 'A'),
          ('Class 6', 'Grade 6', 'A'),
          ('Class 7', 'Grade 7', 'A'),
          ('Class 8', 'Grade 8', 'A')
      `);
      console.log("✓ 11 classes seeded");
    } else {
      console.log("✓ Classes already exist, skipping");
    }

    const classRows = await client.query("SELECT id, name FROM classes ORDER BY id");
    const classMap: Record<string, number> = {};
    for (const r of classRows.rows) classMap[r.name] = r.id;

    await client.query(`DELETE FROM attendance WHERE type = 'staff'`);
    await client.query(`DELETE FROM salaries WHERE true`);
    await client.query(`DELETE FROM staff WHERE true`);
    await client.query(`DELETE FROM users WHERE role IN ('teacher', 'support') AND username != 'admin'`);

    const staffHash = await hashPassword("kips123");

    const realStaff = [
      { no:  1, username: "ambreen.principal", name: "Ambreen",      role: "admin",   subject: "Principal",          salary: 20000, phone: "03361170055" },
      { no:  2, username: "nosheen.teacher",   name: "Nosheen",      role: "teacher", subject: "Senior Teacher",      salary: 7000,  phone: "03361170055" },
      { no:  3, username: "ayesha.teacher",    name: "Ayesha",       role: "teacher", subject: "Co-ordinator",        salary: 5500,  phone: "03361170055" },
      { no:  4, username: "muneeba.teacher",   name: "Muneeba",      role: "teacher", subject: "Teacher",             salary: 3500,  phone: "03361170055" },
      { no:  5, username: "noreen.teacher",    name: "Noreen",       role: "teacher", subject: "Montessori Teacher",  salary: 4000,  phone: "03361170055" },
      { no:  6, username: "maira.teacher",     name: "Maira",        role: "teacher", subject: "Helper",              salary: 2000,  phone: "03361170055" },
      { no:  7, username: "irum.teacher",      name: "Irum",         role: "teacher", subject: "Montessori Teacher",  salary: 3500,  phone: "03361170055" },
      { no:  8, username: "fatima.teacher",    name: "Fatima",       role: "teacher", subject: "Teacher",             salary: 3000,  phone: "03361170055" },
      { no:  9, username: "sohaiba.teacher",   name: "Sohaiba",      role: "teacher", subject: "Teacher",             salary: 4000,  phone: "03361170055" },
      { no: 10, username: "babar.teacher",     name: "Babar",        role: "teacher", subject: "Quran Teacher (Sb.)", salary: 7000,  phone: "03195538767" },
      { no: 11, username: "ghazi.support",     name: "Ghazi Baba",   role: "support", subject: "Guard / C-4",         salary: 6000,  phone: "03109039941" },
      { no: 12, username: "mariyam.teacher",   name: "Mariyam",      role: "teacher", subject: "Montessori Teacher",  salary: 3500,  phone: "03361170055" },
      { no: 13, username: "attiqa.teacher",    name: "Attiqa",       role: "teacher", subject: "Montessori Teacher",  salary: 3500,  phone: "03361170055" },
      { no: 14, username: "muxtaza.teacher",   name: "Qari Muxtaza", role: "teacher", subject: "Arabic Teacher",      salary: 2000,  phone: "03361170055" },
    ];

    const staffIdMap: Record<string, number> = {};
    for (const s of realStaff) {
      const res = await client.query(`
        INSERT INTO staff (name, role, phone, subject, salary, status, username)
        VALUES ($1, $2, $3, $4, $5, 'active', $6)
        RETURNING id
      `, [s.name, s.role, s.phone, s.subject, s.salary, s.username]);
      staffIdMap[s.username] = res.rows[0].id;
      if (s.role === "teacher") {
        await client.query(`
          INSERT INTO users (username, password, role, name)
          VALUES ($1, $2, 'teacher', $3)
          ON CONFLICT (username) DO NOTHING
        `, [s.username, staffHash, s.name]);
      }
    }
    console.log(`✓ ${realStaff.length} real staff seeded`);

    const aprilSalaries = [
      { username: "ambreen.principal", amount: 20000 },
      { username: "nosheen.teacher",   amount: 7000  },
      { username: "ayesha.teacher",    amount: 5500  },
      { username: "muneeba.teacher",   amount: 3500  },
      { username: "noreen.teacher",    amount: 4000  },
      { username: "maira.teacher",     amount: 2000  },
      { username: "irum.teacher",      amount: 3500  },
      { username: "fatima.teacher",    amount: 3000  },
      { username: "sohaiba.teacher",   amount: 4000  },
      { username: "babar.teacher",     amount: 7000  },
      { username: "ghazi.support",     amount: 6000  },
      { username: "mariyam.teacher",   amount: 3500  },
      { username: "attiqa.teacher",    amount: 3500  },
      { username: "muxtaza.teacher",   amount: 2000  },
    ];
    for (const s of aprilSalaries) {
      const sid = staffIdMap[s.username];
      if (!sid) continue;
      await client.query(`INSERT INTO salaries (staff_id, amount, month, paid_date, status) VALUES ($1, $2, '2026-04', '2026-05-02', 'paid')`, [sid, s.amount]);
    }
    console.log("✓ April 2026 salary slips seeded (all Paid)");

    for (const s of aprilSalaries) {
      const sid = staffIdMap[s.username];
      if (!sid) continue;
      await client.query(`INSERT INTO salaries (staff_id, amount, month, status) VALUES ($1, $2, '2026-05', 'unpaid')`, [sid, s.amount]);
    }
    console.log("✓ May 2026 salary records seeded (pending)");

    const teacherAttData: Record<string, Array<{ day: number; status: string }>> = {
      "ambreen.principal": [
        { day: 1, status: "present" }, { day: 2, status: "present" }, { day: 3, status: "holiday" },
        { day: 4, status: "present" }, { day: 5, status: "present" }, { day: 6, status: "present" },
        { day: 7, status: "present" }, { day: 8, status: "present" }, { day: 9, status: "present" },
        { day: 10, status: "holiday" }, { day: 11, status: "present" }, { day: 12, status: "present" },
        { day: 13, status: "present" }, { day: 14, status: "present" }, { day: 15, status: "present" },
        { day: 16, status: "present" }, { day: 17, status: "holiday" },
      ],
      "nosheen.teacher": [
        { day: 1, status: "present" }, { day: 2, status: "present" }, { day: 3, status: "holiday" },
        { day: 4, status: "present" }, { day: 5, status: "present" }, { day: 6, status: "present" },
        { day: 7, status: "present" }, { day: 8, status: "present" }, { day: 9, status: "present" },
        { day: 10, status: "holiday" }, { day: 11, status: "present" }, { day: 12, status: "present" },
        { day: 13, status: "present" }, { day: 14, status: "present" }, { day: 15, status: "present" },
        { day: 16, status: "present" }, { day: 17, status: "holiday" },
      ],
      "noreen.teacher": [
        { day: 1, status: "present" }, { day: 2, status: "present" }, { day: 3, status: "holiday" },
        { day: 4, status: "present" }, { day: 5, status: "present" }, { day: 6, status: "present" },
        { day: 7, status: "leave" }, { day: 8, status: "present" }, { day: 9, status: "leave" },
        { day: 10, status: "holiday" }, { day: 11, status: "present" }, { day: 12, status: "leave" },
        { day: 13, status: "present" }, { day: 14, status: "leave" }, { day: 15, status: "present" },
        { day: 16, status: "absent" }, { day: 17, status: "holiday" },
      ],
      "ayesha.teacher": [
        { day: 1, status: "present" }, { day: 2, status: "present" }, { day: 3, status: "holiday" },
        { day: 4, status: "present" }, { day: 5, status: "present" }, { day: 6, status: "present" },
        { day: 7, status: "present" }, { day: 8, status: "present" }, { day: 9, status: "present" },
        { day: 10, status: "holiday" }, { day: 11, status: "present" }, { day: 12, status: "present" },
        { day: 13, status: "present" }, { day: 14, status: "present" }, { day: 15, status: "present" },
        { day: 16, status: "present" }, { day: 17, status: "holiday" },
      ],
      "muneeba.teacher": [
        { day: 1, status: "present" }, { day: 2, status: "present" }, { day: 3, status: "holiday" },
        { day: 4, status: "present" }, { day: 5, status: "present" }, { day: 6, status: "present" },
        { day: 7, status: "leave" }, { day: 8, status: "present" }, { day: 9, status: "leave" },
        { day: 10, status: "holiday" }, { day: 11, status: "present" }, { day: 12, status: "leave" },
        { day: 13, status: "present" }, { day: 14, status: "leave" }, { day: 15, status: "present" },
        { day: 16, status: "present" }, { day: 17, status: "holiday" },
      ],
      "fatima.teacher": [
        { day: 1, status: "present" }, { day: 2, status: "present" }, { day: 3, status: "holiday" },
        { day: 4, status: "present" }, { day: 5, status: "present" }, { day: 6, status: "present" },
        { day: 7, status: "leave" }, { day: 8, status: "leave" }, { day: 9, status: "leave" },
        { day: 10, status: "holiday" }, { day: 11, status: "present" }, { day: 12, status: "leave" },
        { day: 13, status: "present" }, { day: 14, status: "leave" }, { day: 15, status: "present" },
        { day: 16, status: "present" }, { day: 17, status: "holiday" },
      ],
      "irum.teacher": [
        { day: 1, status: "present" }, { day: 2, status: "present" }, { day: 3, status: "holiday" },
        { day: 4, status: "present" }, { day: 5, status: "present" }, { day: 6, status: "present" },
        { day: 7, status: "present" }, { day: 8, status: "present" }, { day: 9, status: "present" },
        { day: 10, status: "holiday" }, { day: 11, status: "present" }, { day: 12, status: "present" },
        { day: 13, status: "present" }, { day: 14, status: "present" }, { day: 15, status: "present" },
        { day: 16, status: "present" }, { day: 17, status: "holiday" },
      ],
      "sohaiba.teacher": [
        { day: 1, status: "present" }, { day: 2, status: "present" }, { day: 3, status: "holiday" },
        { day: 4, status: "present" }, { day: 5, status: "present" }, { day: 6, status: "present" },
        { day: 7, status: "present" }, { day: 8, status: "present" }, { day: 9, status: "present" },
        { day: 10, status: "holiday" }, { day: 11, status: "present" }, { day: 12, status: "present" },
        { day: 13, status: "leave" }, { day: 14, status: "present" }, { day: 15, status: "present" },
        { day: 16, status: "present" }, { day: 17, status: "holiday" },
      ],
      "maira.teacher": [
        { day: 1, status: "present" }, { day: 2, status: "present" }, { day: 3, status: "holiday" },
        { day: 4, status: "present" }, { day: 5, status: "present" }, { day: 6, status: "present" },
        { day: 7, status: "present" }, { day: 8, status: "present" }, { day: 9, status: "present" },
        { day: 10, status: "holiday" }, { day: 11, status: "present" }, { day: 12, status: "present" },
        { day: 13, status: "leave" }, { day: 14, status: "leave" }, { day: 15, status: "present" },
        { day: 16, status: "present" }, { day: 17, status: "holiday" },
      ],
    };

    let attRows = 0;
    for (const [username, days] of Object.entries(teacherAttData)) {
      const sid = staffIdMap[username];
      if (!sid) continue;
      for (const d of days) {
        const dateStr = `2026-05-${String(d.day).padStart(2, "0")}`;
        await client.query(`INSERT INTO attendance (staff_id, date, type, status) VALUES ($1, $2, 'staff', $3) ON CONFLICT DO NOTHING`, [sid, dateStr, d.status]);
        attRows++;
      }
    }
    console.log(`✓ May 2026 teacher attendance seeded (${attRows} records)`);

    await client.query(`DELETE FROM fees WHERE true`);
    await client.query(`DELETE FROM students WHERE true`);
    await client.query(`DELETE FROM users WHERE role = 'student'`);

    const studentHash = await hashPassword("kips123");

    const classFee: Record<string, number> = {
      "Nursery": 1000, "KG": 1000, "Prep": 1000,
      "Class 1": 1150, "Class 2": 1150, "Class 3": 1150,
      "Class 4": 1300, "Class 5": 1300, "Class 6": 1300,
      "Class 7": 1500, "Class 8": 1500,
    };

    const allStudents = [
      // CLASS 1
      { admNo: "435",  name: "Barzeesa Adnan",   father: "M. Adnan",            cls: "Class 1", sec: "A", gender: "female" },
      { admNo: "409",  name: "M. Sani",           father: "Kamran Ali",          cls: "Class 1", sec: "A", gender: "male"   },
      { admNo: "426",  name: "M. Fashan Ali",     father: "Yasir",               cls: "Class 1", sec: "A", gender: "male"   },
      { admNo: "528",  name: "Umm-e-Aiman",       father: "Noor-Ul-Ain",         cls: "Class 1", sec: "A", gender: "female" },
      { admNo: "521",  name: "Aseeba Abbasi",     father: "Khameed",             cls: "Class 1", sec: "A", gender: "female" },
      { admNo: "430",  name: "Abu-Bakr",          father: "M. Naseem",           cls: "Class 1", sec: "A", gender: "male"   },
      { admNo: "474",  name: "Sajid Naseem",      father: "Nazar Hussain",       cls: "Class 1", sec: "A", gender: "male"   },
      { admNo: "472",  name: "Esa Nazaz",         father: "M. Shoukat",          cls: "Class 1", sec: "A", gender: "male"   },
      { admNo: "424",  name: "Haijra",            father: "M. Younas",           cls: "Class 1", sec: "A", gender: "female" },
      { admNo: "456",  name: "Hashir Younas",     father: "M. Younas",           cls: "Class 1", sec: "A", gender: "male"   },
      { admNo: "457",  name: "Hurain Younas",     father: "M. Manzoor",          cls: "Class 1", sec: "A", gender: "male"   },
      { admNo: "467",  name: "Safa Noor",         father: "M. Arsad",            cls: "Class 1", sec: "A", gender: "female" },
      { admNo: "413",  name: "Abu-Bakir",         father: "Rizwan Ali",          cls: "Class 1", sec: "A", gender: "male"   },
      { admNo: "434",  name: "Alleeza Bibi",      father: "M. Shafique Khan",    cls: "Class 1", sec: "A", gender: "female" },
      { admNo: "587",  name: "A. Rehman",         father: "M. Shafique Khan",    cls: "Class 1", sec: "A", gender: "male"   },
      { admNo: "588",  name: "Umm-e-Hania",       father: "M. Younis",           cls: "Class 1", sec: "A", gender: "female" },
      { admNo: "479",  name: "Zainab Younis",     father: "Naeem Isran",         cls: "Class 1", sec: "A", gender: "female" },
      { admNo: "437",  name: "Huzaifa",           father: "Gulam Nabi",          cls: "Class 1", sec: "A", gender: "male"   },
      { admNo: "448",  name: "Zain Ali",          father: "",                    cls: "Class 1", sec: "A", gender: "male"   },
      { admNo: "432",  name: "Ayesha Bibi",       father: "M. Farooq",           cls: "Class 1", sec: "B", gender: "female" },
      { admNo: "464",  name: "Anaya Ishfaq",      father: "Rafaqat Hussain",     cls: "Class 1", sec: "B", gender: "female" },
      { admNo: "442",  name: "Asma Rafaqat",      father: "Rauf-Uz-Rehman",      cls: "Class 1", sec: "B", gender: "female" },
      { admNo: "403",  name: "Atta-Uz-Rehman",    father: "M. Arshid",           cls: "Class 1", sec: "B", gender: "male"   },
      { admNo: "592",  name: "Isfa Noor",         father: "M. Shakeel",          cls: "Class 1", sec: "B", gender: "female" },
      { admNo: "532",  name: "Sanaullah",         father: "Shah-Nawaz",          cls: "Class 1", sec: "B", gender: "male"   },
      { admNo: "596",  name: "M. Hashim",         father: "M. Riaz",             cls: "Class 1", sec: "B", gender: "male"   },
      { admNo: "406",  name: "Sana Riaz",         father: "M. Riaz",             cls: "Class 1", sec: "B", gender: "female" },
      { admNo: "407",  name: "Naif Riaz",         father: "Maqsood Ahmed",       cls: "Class 1", sec: "B", gender: "male"   },
      { admNo: "462",  name: "Saqlain Ahmed",     father: "Aurangzaib",          cls: "Class 1", sec: "B", gender: "male"   },
      { admNo: "411",  name: "Anaya Fatima",      father: "Shafique-Uz-Rehman",  cls: "Class 1", sec: "B", gender: "female" },
      { admNo: "436",  name: "M. Hussain",        father: "Shafique-Uz-Rehman",  cls: "Class 1", sec: "B", gender: "male"   },
      { admNo: "476",  name: "Fariha Shafique",   father: "M. Rafique",          cls: "Class 1", sec: "B", gender: "female" },
      { admNo: "458",  name: "Akhmad",            father: "M. Sajid",            cls: "Class 1", sec: "B", gender: "male"   },
      { admNo: "516",  name: "M. Hassan",         father: "",                    cls: "Class 1", sec: "B", gender: "male"   },
      { admNo: "358",  name: "Sara Sadaqat",      father: "M. Sadaqat",          cls: "Class 1", sec: "B", gender: "female" },
      { admNo: "523",  name: "Maira Bibi",        father: "M. Rafique",          cls: "Class 1", sec: "B", gender: "female" },
      { admNo: "537",  name: "Aneesha Bibi",      father: "M. Zaheer",           cls: "Class 1", sec: "B", gender: "female" },
      // CLASS 2
      { admNo: "371",  name: "Kulsoom Naz",       father: "Maseeh-Uz-Zaman",     cls: "Class 2", sec: "A", gender: "female" },
      { admNo: "375",  name: "M. Ahtisham",       father: "M. Mushtaq",          cls: "Class 2", sec: "A", gender: "male"   },
      { admNo: "374",  name: "Sidra Mushtaq",     father: "Manzoor Hussain",     cls: "Class 2", sec: "A", gender: "female" },
      { admNo: "373",  name: "Muhammad",          father: "M. Arshid",           cls: "Class 2", sec: "A", gender: "male"   },
      { admNo: "412",  name: "Bibi Sadia",        father: "Zahid Zaman",         cls: "Class 2", sec: "A", gender: "female" },
      { admNo: "372",  name: "M. Jawad",          father: "M. Usman",            cls: "Class 2", sec: "A", gender: "male"   },
      { admNo: "405",  name: "Rehan",             father: "M. Tofique",          cls: "Class 2", sec: "A", gender: "male"   },
      { admNo: "473",  name: "A. Hadi",           father: "M. Rashid",           cls: "Class 2", sec: "A", gender: "male"   },
      { admNo: "367",  name: "Fatiha Noor",       father: "Bilal Ahmed Wani",    cls: "Class 2", sec: "A", gender: "female" },
      { admNo: "366",  name: "Abdullah Bilal",    father: "Kabeer Khan",         cls: "Class 2", sec: "A", gender: "male"   },
      { admNo: "490",  name: "Mantasha Kabeer",   father: "Khani Zaman",         cls: "Class 2", sec: "A", gender: "female" },
      { admNo: "382",  name: "Ayyat Noor",        father: "Faizan",              cls: "Class 2", sec: "A", gender: "female" },
      { admNo: "461",  name: "M. Ayyan",          father: "M. Akbar",            cls: "Class 2", sec: "A", gender: "male"   },
      { admNo: "386",  name: "Aneeq Akbar",       father: "Tufail Azeemullah",   cls: "Class 2", sec: "A", gender: "male"   },
      { admNo: "567",  name: "M. Husnain",        father: "Attique-Ur-Rehman",   cls: "Class 2", sec: "A", gender: "male"   },
      { admNo: "391",  name: "Haijsa Bibi",       father: "Nazaket Gul",         cls: "Class 2", sec: "A", gender: "female" },
      { admNo: "401",  name: "Abu-Bakr",          father: "A. Aziz",             cls: "Class 2", sec: "A", gender: "male"   },
      { admNo: "380",  name: "Faizan",            father: "Aziz-Uz-Rehman",      cls: "Class 2", sec: "A", gender: "male"   },
      { admNo: "419",  name: "Aqsa Noor",         father: "",                    cls: "Class 2", sec: "A", gender: "female" },
      { admNo: "415",  name: "Zainab Bibi",       father: "M. Siraj",            cls: "Class 2", sec: "B", gender: "female" },
      { admNo: "583",  name: "Zasyab",            father: "M. Farooq",           cls: "Class 2", sec: "B", gender: "male"   },
      { admNo: "495",  name: "Nayyab Bibi",       father: "M. Sajid",            cls: "Class 2", sec: "B", gender: "female" },
      { admNo: "394",  name: "M. Sahil",          father: "M. Kashif",           cls: "Class 2", sec: "B", gender: "male"   },
      { admNo: "395",  name: "Kiran",             father: "M. Sajid",            cls: "Class 2", sec: "B", gender: "female" },
      { admNo: "416",  name: "Azeeba",            father: "Aftab Ahmed",         cls: "Class 2", sec: "B", gender: "female" },
      { admNo: "446",  name: "Abdur Rafay",       father: "Shah-Nawaz",          cls: "Class 2", sec: "B", gender: "male"   },
      { admNo: "595",  name: "Hadiya Nawaz",      father: "M. Nazeer",           cls: "Class 2", sec: "B", gender: "female" },
      { admNo: "390",  name: "Afia Noor",         father: "Shafique-Uz-Rehman",  cls: "Class 2", sec: "B", gender: "female" },
      { admNo: "379",  name: "Alishba",           father: "Nazaket",             cls: "Class 2", sec: "B", gender: "female" },
      { admNo: "431",  name: "Samiullah",         father: "Haaj-Nawaz",          cls: "Class 2", sec: "B", gender: "male"   },
      { admNo: "368",  name: "Maira Bibi",        father: "M. Zaheer",           cls: "Class 2", sec: "B", gender: "female" },
      { admNo: "469",  name: "Adeel",             father: "",                    cls: "Class 2", sec: "B", gender: "male"   },
      // CLASS 3
      { admNo: "539",  name: "Talha Touseef",     father: "Abdur-Razzaq",        cls: "Class 3", sec: "A", gender: "male"   },
      { admNo: "536",  name: "Anaya Bibi",        father: "M. Naseem",           cls: "Class 3", sec: "A", gender: "female" },
      { admNo: "562",  name: "Sadia",             father: "M. Akbar",            cls: "Class 3", sec: "A", gender: "female" },
      { admNo: "526",  name: "Abu-Bakr",          father: "Yasir",               cls: "Class 3", sec: "A", gender: "male"   },
      { admNo: "529",  name: "M. Muhavia",        father: "M. Liaqat",           cls: "Class 3", sec: "A", gender: "male"   },
      { admNo: "533",  name: "M. Khizas",         father: "M. Shehraa",          cls: "Class 3", sec: "A", gender: "male"   },
      { admNo: "543",  name: "Ayyat Noor",        father: "Waqar Ahmed",         cls: "Class 3", sec: "A", gender: "female" },
      { admNo: "540",  name: "Abu-Bakis",         father: "M. Tayyab",           cls: "Class 3", sec: "A", gender: "male"   },
      { admNo: "522",  name: "M. Ayyan",          father: "M. Rafique Jalali",   cls: "Class 3", sec: "A", gender: "male"   },
      { admNo: "576",  name: "M. Abbas Jalali",   father: "Sarees",              cls: "Class 3", sec: "A", gender: "male"   },
      { admNo: "571",  name: "A. Hadi",           father: "Tufail Azeemullah",   cls: "Class 3", sec: "A", gender: "male"   },
      { admNo: "568",  name: "Ayyat Noor-2",      father: "Alla-Uz-Rehman",      cls: "Class 3", sec: "A", gender: "female" },
      { admNo: "525",  name: "Yasir Atta",        father: "M. Shafique Khan",    cls: "Class 3", sec: "A", gender: "male"   },
      { admNo: "590",  name: "Abu-Zar Khan",      father: "Ishfaey Ahmed",       cls: "Class 3", sec: "A", gender: "male"   },
      { admNo: "581",  name: "Taimoor Ishfaq",    father: "Aftab Ahmed",         cls: "Class 3", sec: "A", gender: "male"   },
      { admNo: "598",  name: "Zaray Ahmed",       father: "Shafique-Uz-Rehman",  cls: "Class 3", sec: "A", gender: "male"   },
      { admNo: "541",  name: "Muhammad Hamid",    father: "Shafique-Uz-Rehman",  cls: "Class 3", sec: "A", gender: "male"   },
      { admNo: "542",  name: "Khadija Shafique",  father: "M. Riaz",             cls: "Class 3", sec: "A", gender: "female" },
      { admNo: "535",  name: "M. Uzair",          father: "Riaz",                cls: "Class 3", sec: "A", gender: "male"   },
      // CLASS 4
      { admNo: "482",  name: "Muzamil Qureshi",   father: "M. Asit",             cls: "Class 4", sec: "A", gender: "male"   },
      { admNo: "501",  name: "Musfisa Abbasi",    father: "Hasnain Ahmed",       cls: "Class 4", sec: "A", gender: "female" },
      { admNo: "489",  name: "Hadiya Noor",       father: "Shahid Hussain",      cls: "Class 4", sec: "A", gender: "female" },
      { admNo: "518",  name: "Zohra Shahid",      father: "Asad Shabbir",        cls: "Class 4", sec: "A", gender: "female" },
      { admNo: "517",  name: "Romaisa Asad",      father: "Mushtaq",             cls: "Class 4", sec: "A", gender: "female" },
      { admNo: "547",  name: "A. Wahid",          father: "M. Shabbis",          cls: "Class 4", sec: "A", gender: "male"   },
      { admNo: "513",  name: "Abbas Ali",         father: "Sajid-Ur-Rehman",     cls: "Class 4", sec: "A", gender: "male"   },
      { admNo: "497",  name: "M. Sudais",         father: "M. Shehraz",          cls: "Class 4", sec: "A", gender: "male"   },
      { admNo: "493",  name: "Abu-Bakir",         father: "A. Wahid",            cls: "Class 4", sec: "A", gender: "male"   },
      { admNo: "477",  name: "Faheemullah",       father: "Bilal Ahmed Wani",    cls: "Class 4", sec: "A", gender: "male"   },
      { admNo: "475",  name: "Samiullah",         father: "Zia-Ur-Rehman",       cls: "Class 4", sec: "A", gender: "male"   },
      { admNo: "488",  name: "Salma Zia",         father: "Mukheed-Uz-Zaman",    cls: "Class 4", sec: "A", gender: "female" },
      { admNo: "504",  name: "M. Ali",            father: "Aziz-Ur-Rehman",      cls: "Class 4", sec: "A", gender: "male"   },
      { admNo: "481",  name: "Abu-Bakis",         father: "M. Ashraf",           cls: "Class 4", sec: "A", gender: "male"   },
      { admNo: "515",  name: "M. Amjid",          father: "M. Shoaib",           cls: "Class 4", sec: "A", gender: "male"   },
      { admNo: "480",  name: "A. Hadi",           father: "M. Liaqat",           cls: "Class 4", sec: "A", gender: "male"   },
      { admNo: "550",  name: "Shehrish",          father: "Amjid Hussain",       cls: "Class 4", sec: "A", gender: "female" },
      { admNo: "527",  name: "Fawad",             father: "Zaheer Ahmed",        cls: "Class 4", sec: "A", gender: "male"   },
      { admNo: "509",  name: "Kashaf",            father: "",                    cls: "Class 4", sec: "B", gender: "male"   },
      { admNo: "563",  name: "Kafsa",             father: "Zaheer Ahmed",        cls: "Class 4", sec: "B", gender: "female" },
      { admNo: "564",  name: "Ayesha-4",          father: "Munis",               cls: "Class 4", sec: "B", gender: "female" },
      { admNo: "486",  name: "Akhmad-4",          father: "A. Ghani",            cls: "Class 4", sec: "B", gender: "male"   },
      { admNo: "485",  name: "Sanaullah-4",       father: "Ishtaq",              cls: "Class 4", sec: "B", gender: "male"   },
      { admNo: "538",  name: "Abu-Bakir-4",       father: "Zia-Ur-Rehman",       cls: "Class 4", sec: "B", gender: "male"   },
      { admNo: "545",  name: "Fajar Zia",         father: "M. Sajjad",           cls: "Class 4", sec: "B", gender: "male"   },
      { admNo: "498",  name: "Javeria",           father: "Kashif Mehmood",      cls: "Class 4", sec: "B", gender: "female" },
      { admNo: "510",  name: "Muzamil Kashif",    father: "M. Sajid",            cls: "Class 4", sec: "B", gender: "male"   },
      { admNo: "503",  name: "Malaz Ali",         father: "Aftab Ahmed",         cls: "Class 4", sec: "B", gender: "male"   },
      { admNo: "487",  name: "A. Manan",          father: "Sajjad Hussain",      cls: "Class 4", sec: "B", gender: "male"   },
      { admNo: "597",  name: "Hadia Sajjad",      father: "Shah-Jeehan",         cls: "Class 4", sec: "B", gender: "female" },
      { admNo: "470",  name: "Usman Ali",         father: "M. Adnan",            cls: "Class 4", sec: "B", gender: "male"   },
      { admNo: "514",  name: "Kubra Adnan",       father: "M. Sadaqat",          cls: "Class 4", sec: "B", gender: "female" },
      { admNo: "557",  name: "Khadija Sadaqat",   father: "M. Nazeer",           cls: "Class 4", sec: "B", gender: "female" },
      // CLASS 5
      { admNo: "398",  name: "Esa Hafeez",        father: "M. Naseem",           cls: "Class 5", sec: "A", gender: "male"   },
      { admNo: "326",  name: "Fahad Naseem",      father: "Zahid Zaman",         cls: "Class 5", sec: "A", gender: "male"   },
      { admNo: "349",  name: "Fatima Noor-5",     father: "Bilal Ahmed Wani",    cls: "Class 5", sec: "A", gender: "female" },
      { admNo: "332",  name: "Saifullah",         father: "Faizan",              cls: "Class 5", sec: "A", gender: "male"   },
      { admNo: "460",  name: "Ayyat Noor-5",      father: "Rauf-Uz-Rehman",      cls: "Class 5", sec: "A", gender: "female" },
      { admNo: "356",  name: "Bibi Safooa",       father: "Mukheed-Uz-Zaman",    cls: "Class 5", sec: "A", gender: "female" },
      { admNo: "385",  name: "Eman Bibi",         father: "G. Rabbani",          cls: "Class 5", sec: "A", gender: "female" },
      { admNo: "389",  name: "M. Rabbani",        father: "Ijaz Ahmed",          cls: "Class 5", sec: "A", gender: "male"   },
      { admNo: "465",  name: "Sudais Ahmed",      father: "Zia-Uz-Rehman",       cls: "Class 5", sec: "A", gender: "male"   },
      { admNo: "584",  name: "M. Musa",           father: "Rameez Younis",       cls: "Class 5", sec: "A", gender: "male"   },
      { admNo: "438",  name: "M. Muhavia-5",      father: "Haaj-Nawaz",          cls: "Class 5", sec: "A", gender: "male"   },
      { admNo: "351",  name: "Zulgarnain",        father: "M. Shakeel",          cls: "Class 5", sec: "A", gender: "male"   },
      { admNo: "531",  name: "Zaid Ali",          father: "",                    cls: "Class 5", sec: "A", gender: "male"   },
      { admNo: "338",  name: "Amina Sajjad",      father: "M. Sattar",           cls: "Class 5", sec: "A", gender: "female" },
      { admNo: "393",  name: "Maryam Bibi",       father: "M. Arshid",           cls: "Class 5", sec: "A", gender: "female" },
      { admNo: "592b", name: "Ahtisham Ilahi",    father: "Aurangzaib",          cls: "Class 5", sec: "A", gender: "male"   },
      { admNo: "392",  name: "Mahnoor",           father: "Mian M. Basharat",    cls: "Class 5", sec: "A", gender: "female" },
      { admNo: "302",  name: "A. Hafeez",         father: "G. Muttaba",          cls: "Class 5", sec: "A", gender: "male"   },
      { admNo: "302b", name: "Meerab Shehzadi",   father: "Zaheer Ahmed",        cls: "Class 5", sec: "A", gender: "female" },
      { admNo: "455",  name: "Insha Younas",      father: "M. Younas",           cls: "Class 5", sec: "A", gender: "female" },
      { admNo: "323",  name: "Hammax Nazeer",     father: "Manzoor Hussain",     cls: "Class 5", sec: "A", gender: "male"   },
      { admNo: "322",  name: "Iqrash",            father: "Saeed-Uz-Rehman",     cls: "Class 5", sec: "A", gender: "male"   },
      { admNo: "492",  name: "Isfa Shehzadi",     father: "Shafique-Uz-Rehman",  cls: "Class 5", sec: "A", gender: "female" },
      { admNo: "310",  name: "Humma Shafique",    father: "M. Shakeel",          cls: "Class 5", sec: "A", gender: "female" },
      { admNo: "530",  name: "Umm-e-Hania-5",     father: "Sabis Hussain",       cls: "Class 5", sec: "A", gender: "female" },
      { admNo: "408",  name: "Faiza Bibi",        father: "M. Sadaqat",          cls: "Class 5", sec: "A", gender: "female" },
      { admNo: "565",  name: "Zohan Sadaqat",     father: "M. Rustam",           cls: "Class 5", sec: "A", gender: "male"   },
      { admNo: "507",  name: "M. Daniyal",        father: "M. Nazeer",           cls: "Class 5", sec: "A", gender: "male"   },
      { admNo: "508",  name: "A. Raheem",         father: "M. Raheer",           cls: "Class 5", sec: "A", gender: "male"   },
      { admNo: "468",  name: "Muqaddas Bibi",     father: "Zaheer Ahmed",        cls: "Class 5", sec: "A", gender: "female" },
      { admNo: "605",  name: "Usman-5",           father: "M. Farooq",           cls: "Class 5", sec: "A", gender: "male"   },
      // CLASS 6
      { admNo: "601",  name: "Haleema Bibi",      father: "Attique-Ur-Rehman",   cls: "Class 6", sec: "A", gender: "female" },
      { admNo: "602",  name: "Soad Qureshi",      father: "M. Asiq",             cls: "Class 6", sec: "A", gender: "female" },
      { admNo: "603",  name: "Maeva Noor",        father: "Aziz-Ur-Rehman",      cls: "Class 6", sec: "A", gender: "female" },
      { admNo: "604",  name: "M. Arslan",         father: "Shafiqque-Ur-Rehman", cls: "Class 6", sec: "A", gender: "male"   },
      { admNo: "605b", name: "Hafeez Zia",        father: "Zia-Ur-Rehman",       cls: "Class 6", sec: "A", gender: "male"   },
      { admNo: "606",  name: "Ehsan Ashraf",      father: "M. Ashraf",           cls: "Class 6", sec: "A", gender: "male"   },
      { admNo: "607",  name: "Sana Mustafa",      father: "Gulam Mustafa",       cls: "Class 6", sec: "A", gender: "female" },
      // CLASS 7
      { admNo: "701",  name: "Zakriya Nazeer",    father: "M. Nazeer",           cls: "Class 7", sec: "A", gender: "male"   },
      { admNo: "702",  name: "Amaida Bibi",       father: "Rafaqat Ali",         cls: "Class 7", sec: "A", gender: "female" },
      { admNo: "703",  name: "Helcema Bibi",      father: "M. Arshid",           cls: "Class 7", sec: "A", gender: "female" },
      { admNo: "704",  name: "Omaima Younis",     father: "M. Younis",           cls: "Class 7", sec: "A", gender: "female" },
      { admNo: "705",  name: "Sajid-7",           father: "M. Sajjad",           cls: "Class 7", sec: "A", gender: "male"   },
      { admNo: "706",  name: "M. Umar-7",         father: "Tanveer",             cls: "Class 7", sec: "A", gender: "male"   },
      { admNo: "707",  name: "Adeeba Rameez",     father: "Rameez Younis",       cls: "Class 7", sec: "A", gender: "female" },
      // CLASS 8
      { admNo: "801",  name: "Nanium Qureshi",    father: "M. Asiq",             cls: "Class 8", sec: "A", gender: "female" },
      { admNo: "802",  name: "Eshal Rashid",      father: "Rashid",              cls: "Class 8", sec: "A", gender: "female" },
      { admNo: "803",  name: "Bareeva J",         father: "M. Javed",            cls: "Class 8", sec: "A", gender: "female" },
      { admNo: "804",  name: "Bushra A. Ghani",   father: "Abdul Ghani",         cls: "Class 8", sec: "A", gender: "female" },
      { admNo: "805",  name: "M. Usman-8",        father: "M. Farooq",           cls: "Class 8", sec: "A", gender: "male"   },
    ];

    let seededCount = 0;
    for (const s of allStudents) {
      const cid = classMap[s.cls];
      if (!cid) continue;
      const fee = classFee[s.cls] ?? 1000;
      const safeName = s.name.toLowerCase().replace(/[^a-z0-9]/g, ".").replace(/\.+/g, ".");
      const username = `${safeName}.${s.admNo}`;
      const admFull = `KIPS-${s.admNo}`;
      try {
        const res = await client.query(`
          INSERT INTO students (admission_number, name, father_name, class_id, section, date_of_birth, gender, phone, fee_amount, status, username)
          VALUES ($1, $2, $3, $4, $5, '2015-01-01', $6, '', $7, 'active', $8)
          ON CONFLICT (admission_number) DO NOTHING
          RETURNING id
        `, [admFull, s.name, s.father, cid, s.sec, s.gender, fee, username]);
        if (res.rows[0]) {
          await client.query(`
            INSERT INTO users (username, password, role, name)
            VALUES ($1, $2, 'student', $3)
            ON CONFLICT (username) DO NOTHING
          `, [username, studentHash, s.name]);
          seededCount++;
        }
      } catch (_) {}
    }
    console.log(`✓ ${seededCount} real students seeded`);

    const stuRows = await client.query("SELECT id, fee_amount FROM students WHERE status = 'active' AND fee_amount > 0");
    for (const st of stuRows.rows) {
      await client.query(`
        INSERT INTO fees (student_id, amount, paid_amount, month, due_date, status, fine)
        VALUES ($1, $2, 0, '2026-05', '2026-05-10', 'unpaid', 0)
      `, [st.id, st.fee_amount]);
    }
    console.log(`✓ May 2026 fee records seeded (${stuRows.rows.length} students)`);

    const accCount = await client.query("SELECT count(*) as cnt FROM account_entries");
    if (Number(accCount.rows[0].cnt) === 0) {
      await client.query(`
        INSERT INTO account_entries (type, amount, category, description, date) VALUES
          ('income',  125000, 'Fee Collection', 'Monthly fee collection April 2026', '2026-04-10'),
          ('income',   15000, 'Admission Fee',  'New admissions April 2026',          '2026-04-05'),
          ('income',    5000, 'Other',           'Library fines and misc',             '2026-04-14'),
          ('expense',  69500, 'Salaries',        'Staff salaries April 2026 (paid)',   '2026-05-02'),
          ('expense',  12000, 'Utilities',       'Electricity and gas bills',          '2026-04-08'),
          ('expense',   8000, 'Supplies',        'Stationery and supplies',            '2026-04-12'),
          ('expense',   5500, 'Maintenance',     'Building maintenance',               '2026-04-15')
      `);
      console.log("✓ Account entries seeded");
    }

    console.log("\n✅ Seeding complete!");
    console.log("  Admin:    admin / admin123");
    console.log("  Teachers: e.g. nosheen.teacher / kips123");
    console.log(`  Staff: ${realStaff.length} | Students: ${seededCount}`);

  } catch (err) {
    console.error("Seed error:", (err as Error).message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });