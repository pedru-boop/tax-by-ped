import React, { useState, useMemo, useRef, useEffect } from "react";

/* ============================================================
   แบบคำนวณภาษีเงินได้บุคคลธรรมดา ปีภาษี 2569
   ============================================================ */

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
`;

const LARGE = 999999999;

// รายการกลุ่มเลือกในแท็บ 1 — กลุ่มไหนมี subItems จะกางให้ติ๊กย่อยต่อหลังจากติ๊กกลุ่มใหญ่แล้ว
const GROUP_DEFS = [
  { id: "inc_1_2", section: "income", en: "40(1)+(2)", label: "เงินเดือน ค่าจ้าง โบนัส เบี้ยประชุม ค่านายหน้า" },
  { id: "inc_director", section: "income", en: "40(1)", label: "สวัสดิการกรรมการ — เบี้ยประกันที่บริษัทจ่ายแทน" },
  { id: "inc_3", section: "income", en: "40(3)", label: "ค่าลิขสิทธิ์" },
  { id: "inc_4a", section: "income", en: "40(4)ก", label: "ดอกเบี้ย" },
  { id: "inc_4b", section: "income", en: "40(4)ข", label: "เงินปันผล" },
  { id: "inc_5", section: "income", en: "40(5)", label: "ค่าเช่าทรัพย์สิน" },
  { id: "inc_6", section: "income", en: "40(6)", label: "วิชาชีพอิสระ" },
  { id: "inc_78", section: "income", en: "40(7)+(8)", label: "ธุรกิจ พาณิชย์ รับเหมา และเงินได้อื่นๆ" },
  { id: "inc_lumpsum", section: "income", en: "48(5)", label: "เงินได้ออกจากงานครั้งเดียว (บำเหน็จ/PVD) — แยกยื่นภาษีต่างหาก" },
  { id: "inc_crypto", section: "income", en: "40(4)(ฌ)", label: "กำไรจากคริปโทเคอร์เรนซี/สินทรัพย์ดิจิทัล" },
  { id: "ded_1", section: "deduction", en: "กลุ่ม 1", label: "ส่วนตัวและครอบครัว" },
  {
    id: "ded_2", section: "deduction", en: "กลุ่ม 2", label: "ประกันภัย",
    subItems: [
      { id: "social", label: "ประกันสังคม" },
      { id: "selfLifeHealth", label: "ประกันชีวิต + ประกันสุขภาพตนเอง" },
      { id: "spouseLife", label: "ประกันชีวิตคู่สมรส (ไม่มีเงินได้)" },
      { id: "parentHealth", label: "ประกันสุขภาพบิดามารดา" },
    ],
  },
  {
    id: "ded_3", section: "deduction", en: "กลุ่ม 3", label: "กองทุนเพื่อการเกษียณ",
    subItems: [
      { id: "annuity", label: "ประกันชีวิตแบบบำนาญ" },
      { id: "pvd", label: "กองทุนสำรองเลี้ยงชีพ/กบข." },
      { id: "rmf", label: "RMF" },
      { id: "nsf", label: "กอช." },
      { id: "teacherFund", label: "กองทุนสงเคราะห์ครูโรงเรียนเอกชน" },
      { id: "tesg", label: "Thai ESG" },
      { id: "thaiesgx", label: "Thai ESGX" },
    ],
  },
  { id: "ded_4", section: "deduction", en: "กลุ่ม 4", label: "ดอกเบี้ยที่อยู่อาศัย" },
  { id: "ded_5", section: "deduction", en: "กลุ่ม 5", label: "เงินบริจาค" },
  { id: "ded_6", section: "deduction", en: "กลุ่ม 6", label: "อื่นๆ และมาตรการกระตุ้นเศรษฐกิจ (ฝากครรภ์/Easy E-Receipt)" },
];

// เทมเพลตกลุ่มลูกค้า — เลือกแล้วติ๊กกลุ่ม/รายการย่อยที่มักเกี่ยวข้องให้อัตโนมัติ ประหยัดเวลาตอนเจอลูกค้าหน้างาน
const TEMPLATE_DEFS = [
  {
    id: "employee", label: "มนุษย์เงินเดือน",
    groups: ["inc_1_2", "ded_1", "ded_2", "ded_3", "ded_4", "ded_5"],
    subItems: { "ded_2:social": true, "ded_2:selfLifeHealth": true, "ded_3:pvd": true },
  },
  {
    id: "business", label: "เจ้าของธุรกิจ/ฟรีแลนซ์",
    groups: ["inc_78", "ded_1", "ded_2", "ded_3", "ded_5"],
    subItems: { "ded_2:selfLifeHealth": true, "ded_3:rmf": true, "ded_3:tesg": true },
  },
  {
    id: "director", label: "กรรมการบริษัท",
    groups: ["inc_1_2", "inc_director", "inc_4b", "ded_1", "ded_2", "ded_3", "ded_4", "ded_5"],
    subItems: { "ded_2:social": true, "ded_2:selfLifeHealth": true, "ded_3:pvd": true },
  },
];

const APP_LOGO_URI = "__APP_LOGO_DATA_URI__"; // แทนที่ด้วยรูปโลโก้จริง (base64) ตอนประกอบไฟล์ HTML แบบ standalone

const fmt = (n) => {
  const v = Math.round((n || 0) * 100) / 100;
  return v.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const num = (v) => {
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) || n < 0 ? 0 : n;
};

/* ---------- utils: comma-formatted numeric input, tap-to-clear, Enter-to-next ---------- */
const parseDigits = (str) => String(str).replace(/[^0-9]/g, "");
const formatWithCommas = (v) => {
  const digits = parseDigits(v);
  if (digits === "") return "";
  return Number(digits).toLocaleString("en-US");
};
function focusNextField(el) {
  const focusables = Array.from(document.querySelectorAll("input:not([readonly]):not([disabled]), select:not([disabled])"));
  const idx = focusables.indexOf(el);
  if (idx >= 0 && idx < focusables.length - 1) {
    const next = focusables[idx + 1];
    next.focus();
    if (next.select) next.select();
  } else if (el.blur) {
    el.blur();
  }
}
function handleEnterToNext(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    focusNextField(e.target);
  }
}
function handleTapClear(e) {
  if (e.target.select) e.target.select();
}
/* Comma-formatted numeric text field used for every baht amount in the form.
   Keeps the cursor in the right spot as commas get inserted/removed live while typing,
   so digits appear formatted immediately on every keystroke — no need to press Enter or blur first. */
function NumField({ value, onChange, placeholder, style, className }) {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const input = e.target;
    const oldRaw = input.value;
    const oldCursor = input.selectionStart == null ? oldRaw.length : input.selectionStart;
    const digitsBeforeCursor = oldRaw.slice(0, oldCursor).replace(/[^0-9]/g, "").length;
    const newDigits = parseDigits(oldRaw);

    onChange(newDigits);

    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const newFormatted = formatWithCommas(newDigits);
      let count = 0, pos = newFormatted.length;
      for (let i = 0; i < newFormatted.length; i++) {
        if (/[0-9]/.test(newFormatted[i])) count++;
        if (count === digitsBeforeCursor) { pos = i + 1; break; }
      }
      try { el.setSelectionRange(pos, pos); } catch (err) {}
    });
  };

  return (
    <input
      ref={inputRef}
      className={className || "field-input"}
      style={style}
      type="text"
      inputMode="numeric"
      value={formatWithCommas(value)}
      onFocus={handleTapClear}
      onInput={handleChange}
      onKeyDown={handleEnterToNext}
      placeholder={placeholder || "0"}
    />
  );
}

/* ---------- ตารางอัตราภาษีก้าวหน้า ---------- */
const BRACKETS = [
  { from: 0, to: 150000, rate: 0 },
  { from: 150000, to: 300000, rate: 5 },
  { from: 300000, to: 500000, rate: 10 },
  { from: 500000, to: 750000, rate: 15 },
  { from: 750000, to: 1000000, rate: 20 },
  { from: 1000000, to: 2000000, rate: 25 },
  { from: 2000000, to: 5000000, rate: 30 },
  { from: 5000000, to: Infinity, rate: 35 },
];

function progressiveTax(netIncome) {
  let tax = 0;
  const rows = [];
  for (const b of BRACKETS) {
    if (netIncome > b.from) {
      const taxable = Math.min(netIncome, b.to) - b.from;
      const t = (taxable * b.rate) / 100;
      tax += t;
      rows.push({ ...b, taxable, t });
    } else {
      rows.push({ ...b, taxable: 0, t: 0 });
    }
  }
  return { tax, rows };
}

// เงินได้ที่นายจ้างจ่ายให้ครั้งเดียวเพราะเหตุออกจากงาน (เช่น เงินชดเชย, เงินสะสม/สมทบ PVD) — สิทธิ์แยกยื่นภาษีต่างหากตามมาตรา 48(5)
// หักค่าใช้จ่ายพิเศษ 2 ชั้น: ชั้นแรก 7,000 บาท/ปีที่ทำงาน (ทำงานเกิน 183 วันในปีนั้นนับเป็น 1 ปีเต็ม), ชั้นสอง 50% ของส่วนที่เหลือ
// แล้วคำนวณภาษีตามอัตราก้าวหน้าเดียวกัน แต่แยกยื่นเป็นใบแนบ ไม่รวมกับเงินได้อื่นในแบบหลัก
function calcLumpSum(amt, years) {
  const a = Math.max(0, amt);
  const y = Math.max(0, years);
  const exp1 = Math.min(7000 * y, a);
  const afterExp1 = Math.max(0, a - exp1);
  const exp2 = afterExp1 * 0.5;
  const netTaxable = Math.max(0, afterExp1 - exp2);
  const { tax, rows } = progressiveTax(netTaxable);
  return { amt: a, years: y, exp1, exp2, totalExpense: exp1 + exp2, netTaxable, tax, rows };
}

// หาเงินได้สุทธิสูงสุด (X) ที่ทำให้ภาษีขั้นบันไดยังไม่เกิน targetTax — ใช้หาจุด "พอดี" กับเกณฑ์ภาษีขั้นต่ำ ม.48(2)
// แทนที่จะเล็งไปที่ 150,000 (จุดภาษี=0) เสมอ ซึ่งอาจเกินความจำเป็นถ้ามีเกณฑ์ขั้นต่ำมาบังคับอยู่ก่อนแล้ว
function netIncomeForTargetTax(targetTax) {
  if (targetTax <= 0) return 150000;
  let cum = 0;
  for (const b of BRACKETS) {
    if (b.rate === 0) continue;
    const width = b.to === Infinity ? Infinity : b.to - b.from;
    const taxAtBracketEnd = width === Infinity ? Infinity : cum + (b.rate / 100) * width;
    if (targetTax <= taxAtBracketEnd) {
      const neededInBracket = (targetTax - cum) / (b.rate / 100);
      return b.from + neededInBracket;
    }
    cum = taxAtBracketEnd;
  }
  return Infinity;
}

/* ---------- อัตราหักค่าใช้จ่ายเหมา ---------- */
const RENTAL_TYPES = [
  { key: "building", label: "บ้าน โรงเรือน สิ่งปลูกสร้าง แพ", rate: 30 },
  { key: "farmland", label: "ที่ดินที่ใช้ในการเกษตรกรรม", rate: 20 },
  { key: "land", label: "ที่ดินที่มิได้ใช้ในการเกษตรกรรม", rate: 15 },
  { key: "vehicle", label: "ยานพาหนะ", rate: 30 },
  { key: "other", label: "ทรัพย์สินอื่นๆ", rate: 10 },
];
const PROFESSION_TYPES = [
  { key: "medical", label: "ประกอบโรคศิลปะ (แพทย์ ทันตแพทย์ ฯลฯ)", rate: 60 },
  { key: "legalacct", label: "กฎหมาย บัญชี วิศวกรรม สถาปัตยกรรม ประณีตศิลปกรรม", rate: 30 },
];
const BIZ78_TYPES = [
  { key: "general", label: "ธุรกิจการค้าทั่วไป/พาณิชย์/อุตสาหกรรม/เกษตร/ขนส่ง (40(8))", rate: 60 },
  { key: "construction", label: "รับเหมาก่อสร้าง ทั้งค่าแรงและค่าของ (40(7))", rate: 60 },
  { key: "performer_tier", label: "นักแสดงสาธารณะ (ดารา นักร้อง นักกีฬาอาชีพ)", rate: "tier" },
  { key: "actualOnly", label: "อื่นๆ ที่กฎหมายกำหนดให้หักตามจริงเท่านั้น", rate: 0 },
];

function performerExpense(amount) {
  if (amount <= 300000) return amount * 0.6;
  return 300000 * 0.6 + (amount - 300000) * 0.4;
}

/* ============================================================
   ฟังก์ชันคำนวณหลัก — ใช้ร่วมกันทั้ง "แผนปัจจุบัน" และ "แผนใช้สิทธิ์เต็ม"
   ============================================================ */
// ภาษีที่ต้องจ่ายจริง (หรือได้คืน ถ้าติดลบ) — ถ้าใช้เครดิตภาษีเงินปันผล ต้องหักเครดิตออกจากภาษีที่คำนวณได้ก่อน
// ใช้ตัวนี้แทน .finalTax ดิบๆ ทุกจุดที่จะนำไปเปรียบเทียบ/แสดงเป็น "ภาษีที่ต้องเสีย" จริง เพื่อไม่ให้ตัวเลขไม่สอดคล้องกันเวลาเลือกใช้เครดิต
function trueTax(c) {
  return c.hasAnyCredit ? c.netTaxAfterDividendCredit : c.finalTax;
}
// trueTaxTotal: ภาระภาษีที่แท้จริงทั้งหมด รวมภาษี Final Tax ที่ถูกหักไปแล้ว (เช่น 10% ของเงินปันผลตอนเลือกไม่ใช้เครดิต)
// ใช้ตัวนี้เวลาต้อง "เทียบ" ต้นทุนระหว่าง 2 ทางเลือก (ใช้เครดิต vs ไม่ใช้เครดิต) เพราะ trueTax() เพียวๆ จะไม่รวม Final Tax ที่จ่ายแยกไปแล้ว
// ทำให้เทียบกันตรงๆ ไม่ได้ (ฝั่งไม่ใช้เครดิตจะดูต่ำเกินจริง เพราะขาดภาษีปันผล 10% ที่จ่ายไปแล้วไปเลย)
function trueTaxTotal(c) {
  return trueTax(c) + (c.totalFinalTaxWithheld || 0);
}

function buildCalc(income, ded, _skipDirectorCalc) {
  const sSalary = num(income.salary);
  const sCommission = num(income.commission);
  const sRoyalty = num(income.royalty);

  const sInterest = num(income.interestAmt);
  const includeInterest = !income.excludeInterest;
  const interestWhtRate = Math.min(50, Math.max(0, num(income.interestWhtRate))) / 100; // มาตรฐาน 15% แต่ปรับได้ถ้าหนังสือรับรองระบุอัตราอื่น
  const interestFinalTaxWithheld = !includeInterest ? sInterest * interestWhtRate : 0; // ดอกเบี้ยเงินฝาก/พันธบัตร ถูกหัก ณ ที่จ่ายแบบ Final Tax หากเลือกไม่รวมคำนวณ
  const interestWhtCredit = includeInterest ? sInterest * interestWhtRate : 0; // ถ้าเลือกรวมดอกเบี้ยมาคำนวณ ภาษีหัก ณ ที่จ่ายที่ธนาคารหักไปแล้ว นำมาเครดิตคืนได้เช่นเดียวกับเงินปันผล

  const sDividend = num(income.dividendAmt);
  const useDividendCredit = income.dividendMode === "credit";
  const corpTaxRate = Math.min(30, Math.max(0, num(income.corpTaxRate)));
  const dividendCreditAmount = useDividendCredit ? (sDividend * corpTaxRate) / (100 - corpTaxRate) : 0;
  const dividendWhtRate = Math.min(50, Math.max(0, num(income.dividendWhtRate))) / 100; // มาตรฐาน 10% แต่ปรับได้ถ้าหนังสือรับรองระบุอัตราอื่น
  const dividendWht = useDividendCredit ? sDividend * dividendWhtRate : 0;
  const dividendFinalTaxWithheld = !useDividendCredit ? sDividend * dividendWhtRate : 0; // เงินปันผลถูกหัก ณ ที่จ่ายแบบ Final Tax หากเลือกไม่ใช้เครดิต
  const dividendAssessable = useDividendCredit ? sDividend + dividendCreditAmount : 0; // excluded mode -> not assessable at all (WHT final)
  const dividendTotalCredits = dividendCreditAmount + dividendWht; // เฉพาะส่วนเงินปันผล (เครดิต ม.47 ทวิ + ภาษีปันผลหัก ณ ที่จ่าย)
  const allCreditsTotal = dividendTotalCredits + interestWhtCredit; // รวมทุกเครดิตที่ขอคืนได้ (ปันผล + ดอกเบี้ย)
  const hasAnyCredit = dividendTotalCredits > 0 || interestWhtCredit > 0;
  const totalFinalTaxWithheld = interestFinalTaxWithheld + dividendFinalTaxWithheld;

  const base12 = sSalary + sCommission;
  const exp12 = Math.min(base12 * 0.5, 100000);
  const exp3 = Math.min(sRoyalty * 0.5, 100000);

  // สวัสดิการกรรมการ: เบี้ยประกันชีวิต/สุขภาพที่บริษัทจ่ายแทน
  // ถ้าผู้รับผลประโยชน์เป็นบริษัทเอง ไม่ถือเป็นเงินได้ — ถ้าเป็นครอบครัว/ทายาทกรรมการ ถือเป็นเงินได้ตามมาตรา 40(1) ต้องรวมคำนวณ
  const directorBenefitRaw = num(income.directorBenefitAmt);
  const directorBenefitToCompany = !!income.directorBenefitToCompany;
  const directorGrossUp = !!income.directorGrossUp;
  const directorBenefitTaxable = directorBenefitToCompany ? 0 : directorBenefitRaw;

  let directorGrossUpAmount = 0;
  let directorExtraTaxIfNoGrossUp = 0;
  let directorTaxBefore = 0;
  let directorTaxAfterNoGrossUp = 0;
  let directorTaxAfterWithGrossUp = 0;
  let directorGrossUpRate = 0;
  let directorNetIncomeAtGrossUp = 0;
  if (!_skipDirectorCalc && directorBenefitTaxable > 0) {
    // ภาษีที่เพิ่มขึ้นจากการมีสวัสดิการนี้อย่างเดียว (ยังไม่รวมเงินภาษีที่บริษัทออกให้)
    const calcNoBenefit = buildCalc({ ...income, directorBenefitAmt: "0" }, ded, true);
    const calcBenefitOnly = buildCalc({ ...income, directorGrossUp: false }, ded, true);
    directorTaxBefore = trueTax(calcNoBenefit);
    directorTaxAfterNoGrossUp = trueTax(calcBenefitOnly);
    directorExtraTaxIfNoGrossUp = directorTaxAfterNoGrossUp - directorTaxBefore;
    directorNetIncomeAtGrossUp = calcBenefitOnly.netIncomeTaxable;

    if (directorGrossUp && directorExtraTaxIfNoGrossUp > 0) {
      // สูตร Gross-up: เงินภาษีที่บริษัทต้องออกให้ (G) ก็ถือเป็นเงินได้เพิ่มอีกต่อหนึ่ง ต้องคำนวณย้อนกลับด้วยอัตราภาษีขั้นบันไดที่ตกอยู่ ณ ระดับเงินได้นั้น
      // G = ภาษีที่เพิ่มจากสวัสดิการ / (1 - อัตราภาษีขั้นบันได ณ จุดนั้น)
      const bracket = BRACKETS.find((b) => calcBenefitOnly.netIncomeTaxable > b.from && calcBenefitOnly.netIncomeTaxable <= b.to) || BRACKETS[BRACKETS.length - 1];
      const r = bracket.rate / 100;
      directorGrossUpRate = bracket.rate;
      directorGrossUpAmount = r < 1 ? directorExtraTaxIfNoGrossUp / (1 - r) : 0;
      // คำนวณภาษีสุดท้ายโดยใส่ยอดเบี้ยประกัน + เงิน gross-up ที่หาได้แล้วเข้าไปตรงๆ (ห้ามใช้ directorGrossUp:true ซ้ำ เพราะ _skipDirectorCalc จะบล็อกไม่ให้คำนวณ gross-up ซ้อนอีกชั้น ทำให้ค่าที่ได้ผิดไม่รวม G)
      const calcWithGrossUp = buildCalc({ ...income, directorBenefitAmt: String(directorBenefitRaw + directorGrossUpAmount), directorGrossUp: false }, ded, true);
      directorTaxAfterWithGrossUp = trueTax(calcWithGrossUp);
    }
  }
  const directorGrossUpForBase = _skipDirectorCalc ? 0 : (directorGrossUp ? directorGrossUpAmount : 0);

  const base12Full = base12 + directorBenefitTaxable + directorGrossUpForBase;
  const exp12Full = Math.min(base12Full * 0.5, 100000);

  const rAmt = num(income.rentalAmt);
  const rentalPreset = RENTAL_TYPES.find((r) => r.key === income.rentalType);
  const exp5 = income.rentalActual ? Math.min(num(income.rentalActualAmt), rAmt) : (rAmt * rentalPreset.rate) / 100;

  const pAmt = num(income.profAmt);
  const profPreset = PROFESSION_TYPES.find((p) => p.key === income.profType);
  const exp6 = income.profActual ? Math.min(num(income.profActualAmt), pAmt) : (pAmt * profPreset.rate) / 100;

  const bAmt = num(income.bizAmt);
  let exp78 = 0;
  if (income.bizActual) {
    exp78 = Math.min(num(income.bizActualAmt), bAmt);
  } else if (income.bizType === "performer_tier") {
    exp78 = performerExpense(bAmt);
  } else {
    const preset = BIZ78_TYPES.find((b) => b.key === income.bizType);
    exp78 = (bAmt * (typeof preset.rate === "number" ? preset.rate : 0)) / 100;
  }

  const s4Interest = includeInterest ? sInterest : 0;
  const s4Dividend = dividendAssessable; // 0 if excluded (final WHT), grossed-up amount if credit chosen
  // กำไรจากการขาย/โอนคริปโทเคอร์เรนซี/โทเคนดิจิทัล (มาตรา 40(4)(ฌ)) — หักค่าใช้จ่ายไม่ได้เลย นับเฉพาะส่วนที่เป็นกำไร (ขาดทุนไม่นำมาหักลบเงินได้อื่น)
  const cryptoSaleValue = num(income.cryptoSaleValue);
  const cryptoCost = num(income.cryptoCost);
  const cryptoFee = num(income.cryptoFee);
  const cryptoGain = Math.max(0, cryptoSaleValue - cryptoCost - cryptoFee);
  const cryptoWht = num(income.cryptoWht);
  const netBySection = {
    s12: Math.max(0, base12Full - exp12Full),
    s3: Math.max(0, sRoyalty - exp3),
    s4: s4Interest + s4Dividend,
    s4c: cryptoGain,
    s5: Math.max(0, rAmt - exp5),
    s6: Math.max(0, pAmt - exp6),
    s78: Math.max(0, bAmt - exp78),
  };
  const incomeAfterExpense = Object.values(netBySection).reduce((a, b) => a + b, 0);
  const totalGrossIncome = sSalary + sCommission + sRoyalty + s4Interest + s4Dividend + cryptoGain + rAmt + pAmt + bAmt + directorBenefitTaxable + directorGrossUpForBase;
  const nonSalaryIncome240to8 = sCommission + sRoyalty + s4Interest + s4Dividend + cryptoGain + rAmt + pAmt + bAmt;
  const income40 = totalGrossIncome;

  /* ---------- ค่าลดหย่อน ---------- */
  const dPersonal = 60000;

  const dSpouse = ded.hasSpouse ? 60000 : 0;

  const nChildren = Math.max(0, Math.floor(num(ded.childrenTotal)));
  const maxChildrenBonus = Math.max(0, nChildren - 1); // บุตรคนแรก (ตามลำดับการเกิด) ไม่มีสิทธิ์รับโบนัสไม่ว่าจะเกิดปีไหน มีแต่คนที่ 2 ขึ้นไปเท่านั้น
  const childrenBonusRaw = Math.max(0, Math.floor(num(ded.childrenBonus)));
  const nChildrenBonus = Math.min(childrenBonusRaw, maxChildrenBonus);
  const dChildren = nChildren * 30000 + nChildrenBonus * 30000;

  const maxParents = ded.hasSpouse ? 4 : 2;
  const parentsRaw = Math.max(0, Math.floor(num(ded.parents)));
  const parentsUsed = Math.min(maxParents, parentsRaw);
  const dParents = parentsUsed * 30000;

  const dDisabled = Math.max(0, Math.floor(num(ded.disabled))) * 60000;

  const socialCap = 9000;
  const socialRaw = num(ded.socialSecurity);
  const dSocial = Math.min(socialRaw, socialCap);

  const healthCap = 25000;
  const healthRaw = num(ded.healthInsurance);
  const healthUsedOwn = Math.min(healthRaw, healthCap);
  const lifeRaw = num(ded.lifeInsurance);
  const lifeHealthCap = 100000;
  // เบี้ยประกันสวัสดิการกรรมการ (ถ้าต้องนับเป็นเงินได้) ก็ถือเป็นเบี้ยประกันชีวิต/สุขภาพของตัวกรรมการเองด้วย
  // จึงนำมาใช้สิทธิ์ลดหย่อนในกลุ่มนี้ได้ ถ้าสิทธิ์เดิม (จากประกันที่ซื้อเองแล้ว) ยังไม่เต็ม
  const lifeHealthExistingUsed = Math.min(lifeRaw + healthUsedOwn, lifeHealthCap);
  const lifeHealthRoomForDirectorBenefit = Math.max(0, lifeHealthCap - lifeHealthExistingUsed);
  const directorBenefitUsedAsDeduction = Math.min(directorBenefitTaxable, lifeHealthRoomForDirectorBenefit);
  const directorBenefitDeductionExcess = directorBenefitTaxable - directorBenefitUsedAsDeduction;
  const lifeHealthRawSum = lifeRaw + healthUsedOwn + directorBenefitTaxable;
  const dLifeHealth = Math.min(lifeHealthRawSum, lifeHealthCap);

  const spouseInsuranceCap = 10000; // เบี้ยประกันชีวิตของคู่สมรส (เฉพาะกรณีคู่สมรสไม่มีเงินได้) แยกเพดานต่างหาก ไม่รวมกับประกันชีวิตของตนเอง
  const spouseInsuranceRaw = ded.hasSpouse ? num(ded.spouseInsurance) : 0;
  const dSpouseInsurance = Math.min(spouseInsuranceRaw, spouseInsuranceCap);

  const parentHealthCap = 15000;
  const parentHealthRaw = num(ded.parentHealthInsurance);
  const dParentHealth = Math.min(parentHealthRaw, parentHealthCap);

  const annuityCap = Math.min(income40 * 0.15, 200000);
  const annuityRaw = num(ded.annuityInsurance);
  const annuityOwnUsed = Math.min(annuityRaw, annuityCap);

  const pvdCap = Math.min(income40 * 0.15, 500000);
  const pvdRaw = num(ded.pvd);
  const pvdOwnUsed = Math.min(pvdRaw, pvdCap);

  const rmfCap = Math.min(income40 * 0.3, 500000);
  const rmfRaw = num(ded.rmf);
  const rmfOwnUsed = Math.min(rmfRaw, rmfCap);

  const ssfCap = Math.min(income40 * 0.3, 200000);
  const ssfRaw = 0; // สิทธิ์ลดหย่อนภาษีจากการซื้อ SSF ใหม่สิ้นสุดไปแล้วตั้งแต่ปีภาษี 2567 — ปีภาษี 2569 นี้ไม่มีสิทธิ์ลดหย่อนจากการซื้อ SSF อีกต่อไป (ล็อกไว้ที่ 0 เสมอ ไม่ว่าจะกรอกอะไรมาก็ตาม)
  const ssfOwnUsed = Math.min(ssfRaw, ssfCap);

  const nsfCap = 30000;
  const nsfIneligible = num(ded.socialSecurity) > 0 || num(ded.pvd) > 0; // กอช. สมัครไม่ได้ถ้าเป็นผู้ประกันตน ม.33/39 หรือเป็นสมาชิก กบข./กองทุนสำรองเลี้ยงชีพ
  const nsfRaw = nsfIneligible ? 0 : num(ded.nsf);
  const nsfOwnUsed = Math.min(nsfRaw, nsfCap);

  // กองทุนสงเคราะห์ครูโรงเรียนเอกชน — ใช้เกณฑ์เดียวกับ PVD/กบข. (15% ของเงินได้ ไม่เกิน 500,000) อยู่ในกลุ่มเกษียณเพดานรวมเดียวกัน
  const teacherFundCap = Math.min(income40 * 0.15, 500000);
  const teacherFundRaw = num(ded.teacherFund);
  const teacherFundOwnUsed = Math.min(teacherFundRaw, teacherFundCap);

  const GROUP_CAP = 500000;
  const groupOwnUsedTotal = annuityOwnUsed + pvdOwnUsed + rmfOwnUsed + ssfOwnUsed + nsfOwnUsed + teacherFundOwnUsed;
  const groupScale = groupOwnUsedTotal > GROUP_CAP ? GROUP_CAP / groupOwnUsedTotal : 1;
  const dAnnuityFinal = annuityOwnUsed * groupScale;
  const dPvdFinal = pvdOwnUsed * groupScale;
  const dRmfFinal = rmfOwnUsed * groupScale;
  const dSsfFinal = ssfOwnUsed * groupScale;
  const dNsfFinal = nsfOwnUsed * groupScale;
  const dTeacherFundFinal = teacherFundOwnUsed * groupScale;
  const retirementGroupTotal = dAnnuityFinal + dPvdFinal + dRmfFinal + dSsfFinal + dNsfFinal + dTeacherFundFinal;
  const groupMaxAchievable = Math.min(GROUP_CAP, annuityCap + pvdCap + rmfCap + ssfCap + nsfCap + teacherFundCap);
  const groupRemainingNow = Math.max(0, groupMaxAchievable - retirementGroupTotal);

  // กองทุนรวมไทยเพื่อความยั่งยืน (Thai ESG) — 30% ของเงินได้ ไม่เกิน 300,000 บาท แยกเพดานต่างหาก ไม่รวมกับกลุ่มเกษียณ 500,000
  const tesgCap = Math.min(income40 * 0.3, 300000);
  const tesgRaw = num(ded.tesg);
  const dTesg = Math.min(tesgRaw, tesgCap);

  // Thai ESGX — เฉพาะผู้ที่สับเปลี่ยนหน่วยลงทุน LTF เดิมมาเป็น ThaiESGX ช่วง พ.ค.-มิ.ย. 2568 เท่านั้น
  // ปีภาษี 2569 อยู่ในช่วงปีที่ 2 ของสิทธิ์ (2569-2572) เพดานคงที่ปีละ 50,000 บาท แยกต่างหาก ไม่รวมกับกลุ่มเกษียณและ Thai ESG
  const thaiesgxCap = 50000;
  const thaiesgxRaw = num(ded.thaiesgx);
  const dThaiesgx = Math.min(thaiesgxRaw, thaiesgxCap);

  // สิทธิยกเว้นเงินได้ผู้สูงอายุ (65 ปีบริบูรณ์ขึ้นไป) หรือผู้พิการที่มีบัตรประจำตัวคนพิการ (ตัวผู้มีเงินได้เอง) — ยกเว้นเงินได้ 190,000 บาทแรก
  // ข้อสำคัญ: นี่คือ "เงินได้ที่ได้รับยกเว้น" ไม่ใช่ "ค่าลดหย่อน" — ตามลำดับการคำนวณที่ถูกต้องต้องหักออกจากเงินได้หลังหักค่าใช้จ่ายก่อน แล้วจึงค่อยนำเงินได้ส่วนที่เหลือไปหักค่าลดหย่อนต่างๆ (ไม่ใช่ปนกันในขั้นตอนเดียว)
  const ageNum = num(ded.age);
  const elderlyOrDisabled = ageNum >= 65 || !!ded.selfDisabled;
  const isElderly = ageNum >= 65;
  const elderlyDisabledExemption = elderlyOrDisabled ? Math.min(190000, incomeAfterExpense) : 0;
  const incomeAfterExemption = Math.max(0, incomeAfterExpense - elderlyDisabledExemption);

  const homeInterestCap = 100000;
  const homeInterestRaw = num(ded.homeInterest);
  const dHomeInterest = Math.min(homeInterestRaw, homeInterestCap);

  const maternityCap = 60000;
  const maternityRaw = num(ded.maternity);
  const dMaternity = Math.min(maternityRaw, maternityCap);

  const easyReceiptCap = 50000;
  const easyReceiptRaw = num(ded.easyReceipt);
  const dEasyReceipt = Math.min(easyReceiptRaw, easyReceiptCap);

  const partyCap = 10000;
  const partyRaw = num(ded.donateParty);
  const dPartyDonate = Math.min(partyRaw, partyCap);

  const beforeDonationDeductTotal =
    dPersonal + dSpouse + dChildren + dParents + dDisabled + dSocial + dLifeHealth + dSpouseInsurance + dParentHealth +
    retirementGroupTotal + dTesg + dThaiesgx + dHomeInterest + dMaternity + dEasyReceipt + dPartyDonate;
  const incomeBeforeDonation = Math.max(0, incomeAfterExemption - beforeDonationDeductTotal);
  // เงินบริจาคคำนวณเป็น 2 ขั้นตอนต่อเนื่องกัน (ไม่ใช่เพดาน 10% รวมเดียว):
  // ขั้น 1: หักบริจาค 2 เท่าก่อน ไม่เกิน 10% ของฐานเดิม
  // ขั้น 2: เอาเงินที่เหลือหลังหักขั้น 1 มาคำนวณเพดาน 10% ใหม่ แล้วค่อยหักบริจาคทั่วไป
  const donateGeneralRaw = num(ded.donateGeneral);
  const donateDoubleRaw = num(ded.donateDouble) * 2;
  const donationRawTotal = donateGeneralRaw + donateDoubleRaw;

  const doubleCap = incomeBeforeDonation * 0.1;
  const dDonateDouble = Math.min(donateDoubleRaw, doubleCap);
  const afterDoubleDonation = incomeBeforeDonation - dDonateDouble;

  const generalCap = afterDoubleDonation * 0.1;
  const dDonateGeneral = Math.min(donateGeneralRaw, generalCap);

  const donationCap = doubleCap + generalCap; // เพดานรวมของทั้ง 2 ขั้น (เพื่อแสดงผลรวมให้เห็นภาพ)
  const dDonation = dDonateDouble + dDonateGeneral;

  const totalDeductions = beforeDonationDeductTotal + dDonation;
  const netIncomeTaxable = Math.max(0, incomeAfterExemption - totalDeductions);
  const { tax: taxProgressive, rows } = progressiveTax(netIncomeTaxable);

  let taxMin = 0, minApplies = false;
  if (nonSalaryIncome240to8 >= 120000) {
    const t = nonSalaryIncome240to8 * 0.005;
    if (t > 5000) { taxMin = t; minApplies = true; }
  }
  const finalTax = Math.max(taxProgressive, minApplies ? taxMin : 0);
  const usedMinRule = minApplies && taxMin > taxProgressive;

  // ผลของการใช้เครดิตภาษี: หักเครดิตเงินปันผล (ถ้าเลือกใช้) + เครดิตภาษีดอกเบี้ยหัก ณ ที่จ่าย (ถ้ารวมดอกเบี้ยมาคำนวณ) ออกจากภาษีที่คำนวณได้รวม
  const netTaxAfterDividendCredit = finalTax - allCreditsTotal;
  const isDividendRefund = hasAnyCredit && netTaxAfterDividendCredit < 0;

  // ภาษีหัก ณ ที่จ่ายที่ถูกหักไว้แล้วระหว่างปี (เช่น จากเงินเดือน/ค่าจ้าง/ค่าบริการที่นำมารวมคำนวณ) — เป็นเครดิตหักออกจากภาษีที่ต้องยื่นชำระ
  // รวมจากช่องกรอกแยกของแต่ละประเภทเงินได้ (ไม่รวมดอกเบี้ย/เงินปันผลซึ่งคำนวณอัตโนมัติแยกต่างหากแล้วด้านบน)
  const withholdingPaid = num(income.whtSalary) + num(income.whtRoyalty) + num(income.whtRental) + num(income.whtProf) + num(income.whtBiz) + cryptoWht;
  const filingTax = hasAnyCredit ? netTaxAfterDividendCredit : finalTax;
  const netPayableAfterWithholding = filingTax - withholdingPaid;
  const isOverallRefund = netPayableAfterWithholding < 0;

  // ภาระภาษีที่แท้จริงทั้งหมด = ยอดที่ต้องจ่ายเพิ่ม/ได้คืนจากการยื่นแบบ (หลังหัก WHT ที่จ่ายไปแล้ว) + Final Tax ที่ถูกหักไปแล้วต่างหาก (ดอกเบี้ย/ปันผลกรณีไม่ใช้เครดิต ซึ่งไม่ได้เข้ามาอยู่ในการยื่นแบบเลย)
  const totalRealTaxBurden = netPayableAfterWithholding + totalFinalTaxWithheld;

  return {
    exp12: exp12Full, exp3, exp5, exp6, exp78, netBySection, incomeAfterExpense, totalGrossIncome, nonSalaryIncome240to8, income40,
    directorBenefitRaw, directorBenefitToCompany, directorGrossUp, directorBenefitTaxable, directorGrossUpAmount, directorExtraTaxIfNoGrossUp,
    cryptoSaleValue, cryptoCost, cryptoFee, cryptoGain, cryptoWht,
    directorTaxBefore, directorTaxAfterNoGrossUp, directorTaxAfterWithGrossUp, directorGrossUpRate, directorNetIncomeAtGrossUp,
    sInterest, sDividend, useDividendCredit, corpTaxRate, interestWhtRate, dividendWhtRate, dividendCreditAmount, dividendWht, dividendAssessable, dividendTotalCredits,
    interestWhtCredit, allCreditsTotal, hasAnyCredit,
    netTaxAfterDividendCredit, isDividendRefund,
    interestFinalTaxWithheld, dividendFinalTaxWithheld, totalFinalTaxWithheld, filingTax, totalRealTaxBurden,
    withholdingPaid, netPayableAfterWithholding, isOverallRefund,
    dPersonal, dSpouse, dChildren, nChildren, maxChildrenBonus, childrenBonusRaw, nChildrenBonus, dParents, dDisabled, maxParents, parentsUsed, parentsRaw,
    elderlyOrDisabled, isElderly, elderlyDisabledExemption, incomeAfterExemption,
    dSocial, socialCap, socialRaw,
    dLifeHealth, lifeHealthCap, lifeHealthRawSum, healthCap, healthRaw, lifeRaw, healthUsedOwn,
    lifeHealthExistingUsed, lifeHealthRoomForDirectorBenefit, directorBenefitUsedAsDeduction, directorBenefitDeductionExcess,
    dSpouseInsurance, spouseInsuranceCap, spouseInsuranceRaw,
    dParentHealth, parentHealthCap, parentHealthRaw,
    annuityCap, annuityRaw, annuityOwnUsed, dAnnuityFinal,
    pvdCap, pvdRaw, pvdOwnUsed, dPvdFinal,
    rmfCap, rmfRaw, rmfOwnUsed, dRmfFinal,
    ssfCap, ssfRaw, ssfOwnUsed, dSsfFinal,
    nsfCap, nsfRaw, nsfOwnUsed, dNsfFinal, nsfIneligible,
    groupOwnUsedTotal, groupScale, retirementGroupTotal, groupMaxAchievable, groupRemainingNow, GROUP_CAP,
    teacherFundCap, teacherFundRaw, teacherFundOwnUsed, dTeacherFundFinal,
    tesgCap, tesgRaw, dTesg,
    thaiesgxCap, thaiesgxRaw, dThaiesgx,
    dHomeInterest, homeInterestCap, homeInterestRaw,
    dMaternity, maternityCap, maternityRaw,
    dEasyReceipt, easyReceiptCap, easyReceiptRaw,
    dPartyDonate, partyCap, partyRaw,
    dDonation, donationCap, donationRawTotal, incomeBeforeDonation,
    dDonateDouble, dDonateGeneral, doubleCap, generalCap, afterDoubleDonation, donateDoubleRaw, donateGeneralRaw,
    totalDeductions, netIncomeTaxable, taxProgressive, rows, taxMin, usedMinRule, finalTax,
  };
}

// computeGrossUpRounds: คำนวณ Gross-up แบบวนซ้ำจริง (ไม่ใช่สูตรลัด) — แต่ละรอบเอาภาษีของรอบก่อนไปทบเป็นรายได้เพิ่ม แล้ววนจนกว่าภาษีที่ต้องทบเพิ่มจะเข้าใกล้ 0 (ลู่เข้า)
function computeGrossUpRounds(income, ded, maxRounds = 30, threshold = 1) {
  const benefitRaw = num(income.directorBenefitAmt);
  const baseline = buildCalc({ ...income, directorBenefitAmt: "0" }, ded, true);
  const baselineTax = trueTax(baseline);
  const baseIncomeOnly = baseline.totalGrossIncome; // รายได้เดิมล้วนๆ ไม่รวมสวัสดิการ/G เลย
  const rounds = [];
  let g = 0; // เงิน gross-up ที่ทบเข้าไปแล้วก่อนรอบนี้
  for (let i = 1; i <= maxRounds; i++) {
    const totalBenefitThisRound = benefitRaw + g;
    const c = buildCalc({ ...income, directorBenefitAmt: String(totalBenefitThisRound), directorGrossUp: false }, ded, true);
    const taxThisRound = trueTax(c);
    const newG = taxThisRound - baselineTax; // ภาษีที่แท้จริงทั้งหมดที่ต้องออกให้ ณ ตอนนี้
    const increment = newG - g; // ส่วนที่ต้องทบเพิ่มอีกในรอบถัดไป (เพราะเงิน gross-up เองก็โดนภาษีอีกที)

    rounds.push({
      round: i,
      baseIncomeOnly,
      benefitPlusG: totalBenefitThisRound,
      totalGrossIncome: c.totalGrossIncome,
      expenseDeducted: c.totalGrossIncome - c.incomeAfterExpense,
      incomeAfterExpense: c.incomeAfterExpense,
      totalDeductions: c.totalDeductions,
      netIncomeTaxable: c.netIncomeTaxable,
      taxComputed: taxThisRound,
      gBefore: g,
      gAfter: newG,
      increment,
      converged: Math.abs(increment) < threshold,
    });

    g = newG;
    if (Math.abs(increment) < threshold) break;
  }
  return { rounds, baselineTax, finalG: g, benefitRaw };
}

const emptyIncome = () => ({
  salary: "", commission: "", royalty: "",
  directorBenefitAmt: "", directorBenefitToCompany: true, directorGrossUp: false,
  lumpSumAmt: "", lumpSumYears: "",
  cryptoSaleValue: "", cryptoCost: "", cryptoFee: "", cryptoWht: "",
  whtSalary: "", whtRoyalty: "", whtRental: "", whtProf: "", whtBiz: "",
  interestAmt: "", excludeInterest: false, interestWhtRate: "15",
  dividendAmt: "", dividendMode: "exclude", corpTaxRate: "20", dividendWhtRate: "10",
  rentalAmt: "", rentalType: "building", rentalActual: false, rentalActualAmt: "",
  profAmt: "", profType: "medical", profActual: false, profActualAmt: "",
  bizAmt: "", bizType: "general", bizActual: false, bizActualAmt: "",
});
const emptyDed = () => ({
  hasSpouse: false, childrenTotal: "", childrenBonus: "", parents: "", disabled: "",
  age: "", selfDisabled: false,
  socialSecurity: "", lifeInsurance: "", healthInsurance: "", spouseInsurance: "", parentHealthInsurance: "", annuityInsurance: "",
  pvd: "", rmf: "", ssf: "", nsf: "", teacherFund: "", tesg: "", thaiesgx: "", homeInterest: "",
  donateGeneral: "", donateDouble: "", donateParty: "", maternity: "", easyReceipt: "",
});

export default function App() {
  const [taxpayerName, setTaxpayerName] = useState("");
  const [retireAge, setRetireAge] = useState("60");
  const [advisorName, setAdvisorName] = useState("");
  const [advisorPhone, setAdvisorPhone] = useState("");
  const [printMode, setPrintMode] = useState("summary"); // "summary" | "investment" — เลือกว่าจะพิมพ์ใบไหนตอนกดปุ่มพิมพ์

  const [income, setIncome] = useState(emptyIncome());
  const [ded, setDed] = useState(emptyDed());

  const calc = useMemo(() => buildCalc(income, ded), [income, ded]);

  // เปรียบเทียบเงินปันผลสองวิธี โดยคำนวณรวมกับเงินได้ทุกประเภทที่กรอกไว้จริง (ไม่ใช่แค่เงินปันผลตัวเดียว)
  const calcDivExclude = useMemo(() => buildCalc({ ...income, dividendMode: "exclude" }, ded), [income, ded]);
  const calcDivCredit = useMemo(() => buildCalc({ ...income, dividendMode: "credit" }, ded), [income, ded]);
  // เทียบกันตรงๆ จาก "ภาษีจากการยื่นแบบ" ของแต่ละวิธี (หักเครดิตแล้วถ้ามี) — ฝั่งไหนต้องจ่ายน้อยกว่าคือฝั่งนั้นคุ้มกว่า
  // (ไม่เอาภาษีหัก ณ ที่จ่าย 10% มารวมเทียบซ้ำ เพราะเป็นเงินที่ถูกหักไปแล้วเท่ากันไม่ว่าจะเลือกวิธีไหน จะเอามาหักซ้ำเป็นส่วนลดของฝั่งเครดิตไม่ได้)
  const divExcludeTrueTax = trueTax(calcDivExclude);
  const divCreditTrueTax = trueTax(calcDivCredit);
  const divCreditIsBetter = calc.sDividend > 0 && divCreditTrueTax < divExcludeTrueTax;

  // เปรียบเทียบดอกเบี้ยสองวิธีเหมือนเงินปันผล — ไม่รวมคำนวณ (Final Tax 15%) vs รวมคำนวณ (ได้เครดิตภาษีที่หักไว้คืน)
  const calcIntExclude = useMemo(() => buildCalc({ ...income, excludeInterest: true }, ded), [income, ded]);
  const calcIntInclude = useMemo(() => buildCalc({ ...income, excludeInterest: false }, ded), [income, ded]);
  const intExcludeTrueTax = trueTax(calcIntExclude);
  const intIncludeTrueTax = trueTax(calcIntInclude);
  const intIncludeIsBetter = num(income.interestAmt) > 0 && intIncludeTrueTax < intExcludeTrueTax;

  // ใบเปรียบเทียบแบบเต็มขั้นตอน ก่อน-หลังมีสวัสดิการกรรมการ (ใช้ในการ์ดสวัสดิการกรรมการ กดดูรายละเอียดได้)
  const calcDirectorNoBenefit = useMemo(() => buildCalc({ ...income, directorBenefitAmt: "0" }, ded), [income, ded]);
  const [showDirectorDetail, setShowDirectorDetail] = useState(false);
  const [showGrossUpSteps, setShowGrossUpSteps] = useState(false);

  const calcMax = useMemo(() => {
    const maxDed = {
      ...ded,
      lifeInsurance: LARGE, healthInsurance: LARGE, spouseInsurance: LARGE, parentHealthInsurance: LARGE,
      annuityInsurance: LARGE, pvd: LARGE, rmf: LARGE, ssf: LARGE, nsf: LARGE, teacherFund: LARGE, tesg: LARGE, thaiesgx: LARGE,
    };
    return buildCalc(income, maxDed);
  }, [income, ded]);

  const [planItems, setPlanItems] = useState({}); // { itemKey: amountString }
  const [planRate, setPlanRate] = useState("3");
  const [showDetail, setShowDetail] = useState(false);

  // แท็บ 1 (เลือกรายการ) / แท็บ 2 (กรอกข้อมูล+คำนวณ)
  const [activeTab, setActiveTab] = useState("select");
  const [selectedGroups, setSelectedGroups] = useState({});
  const [selectedSubItems, setSelectedSubItems] = useState({}); // key: "groupId:subId"
  const [showAddMore, setShowAddMore] = useState(false);
  const tab2Ref = useRef(null);
  const goToFillTab = () => {
    setActiveTab("fill");
    setTimeout(() => {
      tab2Ref.current && tab2Ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };
  const toggleGroup = (id) => setSelectedGroups((g) => ({ ...g, [id]: !g[id] }));
  const toggleSubItem = (groupId, subId) => {
    const key = `${groupId}:${subId}`;
    setSelectedSubItems((s) => ({ ...s, [key]: !s[key] }));
  };
  const isSubSelected = (groupId, subId) => !!selectedSubItems[`${groupId}:${subId}`];
  const anySelected = Object.values(selectedGroups).some(Boolean);

  // ---- จัดการเคสลูกค้า (บันทึก/โหลด/ลบ ในเบราว์เซอร์ของเครื่องนี้) ----
  const CASE_LIST_KEY = "taxbyped_case_list_2569";
  const CASE_PREFIX = "taxbyped_case_2569_";
  const [caseNameInput, setCaseNameInput] = useState("");
  const [savedCases, setSavedCases] = useState([]);
  const [showCaseManager, setShowCaseManager] = useState(false);
  const [caseMsg, setCaseMsg] = useState("");

  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem(CASE_LIST_KEY) || "[]");
      setSavedCases(list);
    } catch (e) {}
  }, []);

  const saveCurrentCase = () => {
    const name = caseNameInput.trim();
    if (!name) return;
    const state = {
      taxpayerName, retireAge, advisorName, advisorPhone,
      income, ded, planItems, planRate, selectedGroups, selectedSubItems,
    };
    try {
      localStorage.setItem(CASE_PREFIX + name, JSON.stringify(state));
      const list = savedCases.includes(name) ? savedCases : [...savedCases, name];
      localStorage.setItem(CASE_LIST_KEY, JSON.stringify(list));
      setSavedCases(list);
      setCaseNameInput("");
      setCaseMsg(`บันทึกเคส "${name}" แล้ว`);
      setTimeout(() => setCaseMsg(""), 3000);
    } catch (e) {
      setCaseMsg("บันทึกไม่สำเร็จ (พื้นที่เก็บข้อมูลของเบราว์เซอร์อาจเต็ม)");
    }
  };

  const loadCase = (name) => {
    try {
      const raw = localStorage.getItem(CASE_PREFIX + name);
      if (!raw) return;
      const state = JSON.parse(raw);
      setTaxpayerName(state.taxpayerName || "");
      setRetireAge(state.retireAge || "60");
      setAdvisorName(state.advisorName || "");
      setAdvisorPhone(state.advisorPhone || "");
      setIncome({ ...emptyIncome(), ...(state.income || {}) });
      setDed({ ...emptyDed(), ...(state.ded || {}) });
      setPlanItems(state.planItems || {});
      setPlanRate(state.planRate || "3");
      setSelectedGroups(state.selectedGroups || {});
      setSelectedSubItems(state.selectedSubItems || {});
      setShowCaseManager(false);
      goToFillTab();
    } catch (e) {}
  };

  const deleteCase = (name) => {
    try {
      localStorage.removeItem(CASE_PREFIX + name);
      const list = savedCases.filter((n) => n !== name);
      localStorage.setItem(CASE_LIST_KEY, JSON.stringify(list));
      setSavedCases(list);
    } catch (e) {}
  };

  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const applyTemplate = (tpl) => {
    const g = {};
    tpl.groups.forEach((id) => { g[id] = true; });
    setSelectedGroups(g);
    setSelectedSubItems(tpl.subItems || {});
    setSelectedTemplate(tpl.id);
  };

  // เช็คว่าการ์ดไหนมีการกรอกข้อมูลไว้แล้วบ้าง — ใช้ทำกรอบเน้นสีเข้ม ให้เห็นชัดว่ากรอกแล้วโดยไม่ต้องเปิดดู
  const hasVal = (v) => v !== "" && v !== undefined && v !== null && num(v) !== 0;
  const cardFilled = {
    inc_1_2: hasVal(income.salary) || hasVal(income.commission) || hasVal(income.whtSalary),
    inc_director: hasVal(income.directorBenefitAmt),
    inc_3: hasVal(income.royalty) || hasVal(income.whtRoyalty),
    inc_4a: hasVal(income.interestAmt),
    inc_4b: hasVal(income.dividendAmt),
    inc_5: hasVal(income.rentalAmt) || hasVal(income.whtRental),
    inc_6: hasVal(income.profAmt) || hasVal(income.whtProf),
    inc_78: hasVal(income.bizAmt) || hasVal(income.whtBiz),
    ded_1: ded.hasSpouse || hasVal(ded.childrenTotal) || hasVal(ded.parents) || hasVal(ded.disabled),
    ded_2: hasVal(ded.socialSecurity) || hasVal(ded.healthInsurance) || hasVal(ded.lifeInsurance) || hasVal(ded.spouseInsurance) || hasVal(ded.parentHealthInsurance),
    ded_3: hasVal(ded.annuityInsurance) || hasVal(ded.pvd) || hasVal(ded.rmf) || hasVal(ded.nsf) || hasVal(ded.teacherFund) || hasVal(ded.tesg) || hasVal(ded.thaiesgx),
    ded_4: hasVal(ded.homeInterest),
    ded_5: hasVal(ded.donateGeneral) || hasVal(ded.donateDouble) || hasVal(ded.donateParty),
    ded_6: hasVal(ded.maternity) || hasVal(ded.easyReceipt),
  };

  // ปุ่มล้างข้อมูล: ใช้การยืนยัน 2 ขั้นตอนในหน้าเว็บเอง แทน window.confirm()
  // เพราะกล่องยืนยันของเบราว์เซอร์มักถูกบล็อกเมื่อรันอยู่ใน iframe ของหน้าตัวอย่าง ทำให้ปุ่มดูเหมือนกดไม่ติด
  const [confirmClear, setConfirmClear] = useState(false);
  const clearAllData = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    setConfirmClear(false);
    setTaxpayerName("");
    setRetireAge("60");
    setIncome(emptyIncome());
    setDed(emptyDed());
    setPlanItems({});
    setPlanRate("3");
    setShowDetail(false); // ปิดใบสรุปฉบับเต็มถ้าเคยกดดูไว้
    setActiveTab("select"); // กลับไปเริ่มที่แท็บเลือกรายการใหม่
    setSelectedGroups({});
    setSelectedTemplate(null);
    setSelectedSubItems({});
    setShowAddMore(false);
  };

  const roomTotal = Math.max(0, calcMax.totalDeductions - calc.totalDeductions);
  const baseNet = calc.netIncomeTaxable;
  const years = Math.max(0, num(retireAge) - num(ded.age));
  const rate = num(planRate) / 100;

  // ใช้ตัวเลข "ภาษีที่ต้องจ่ายจริง" (หลังหักเครดิตภาษีเงินปันผลแล้ว ถ้าเลือกใช้เครดิต) เป็นฐานเปรียบเทียบทุกจุด
  // เพื่อให้สอดคล้องกับวิธีที่เลือกไว้ที่กล่องสรุปด้านบน (ไม่ใช้เครดิต/ใช้เครดิต) ไม่ใช่ตัวเลขก่อนหักเครดิตซึ่งจะทำให้ดูเหมือนใช้เครดิตแล้วเสียภาษีเพิ่มขึ้น
  const calcTrueTax = trueTax(calc);
  const calcMaxTrueTax = trueTax(calcMax);
  const taxSavedTotal = calcTrueTax - calcMaxTrueTax;
  const taxSavedPct = calcTrueTax > 0 ? (taxSavedTotal / calcTrueTax) * 100 : 0;

  // "แนะนำ": จำนวนขั้นต่ำที่ต้องซื้อเพิ่มเพื่อให้ภาษีเหลือน้อยที่สุด (ไม่ใช่ซื้อเต็มทุกบาท)
  const targetNetIncomeForFloor = netIncomeForTargetTax(calc.taxMin);
  const zeroTargetAdd = Math.max(0, calc.netIncomeTaxable - targetNetIncomeForFloor);
  const smartAdd = Math.min(zeroTargetAdd, roomTotal);
  const smartNet = Math.max(0, calc.netIncomeTaxable - smartAdd);
  const smartProgTax = progressiveTax(smartNet).tax;
  const smartFinalTaxRaw = Math.max(smartProgTax, calc.taxMin);
  // เครดิตภาษีเงินปันผล (ถ้าใช้) ไม่เปลี่ยนตามค่าลดหย่อนที่ซื้อเพิ่ม จึงหักออกเท่าเดิมเสมอ
  const smartFinalTax = calc.hasAnyCredit ? smartFinalTaxRaw - calc.allCreditsTotal : smartFinalTaxRaw;
  const canReachZero = zeroTargetAdd <= roomTotal;

  // รายการสิทธิ์ลดหย่อนที่ยังซื้อเพิ่มได้ แยกเป็นรายตัว อ้างอิงเพดานตามรายได้จริงของแต่ละคน (เพดานเฉพาะตัว ยังไม่หักเพดานรวมกลุ่มเกษียณ)
  const healthSubRemaining = Math.max(0, calc.healthCap - calc.healthUsedOwn);
  const lifeHealthRemaining = Math.max(0, calc.lifeHealthCap - calc.dLifeHealth);
  const lifeHealthNote = healthSubRemaining < 0.5
    ? `ประกันสุขภาพใช้สิทธิ์เต็ม 25,000 บาทแล้ว — ที่เหลือซื้อเพิ่มได้เฉพาะส่วนประกันชีวิตอีก ${fmt(lifeHealthRemaining)} บาท (จากเพดานรวม 100,000)`
    : `ประกันสุขภาพเหลือสิทธิ์อีก ${fmt(healthSubRemaining)} บาท (เพดานย่อย 25,000) · ประกันชีวิตเหลือซื้อเพิ่มได้สูงสุด ${fmt(lifeHealthRemaining)} บาท (รวมกันไม่เกิน 100,000)`;

  const purchasableItems = [
    { key: "lifehealth", label: "เบี้ยประกันชีวิต + สุขภาพตนเอง", note: lifeHealthNote, remaining: lifeHealthRemaining, group: false },
    { key: "parenthealth", label: "เบี้ยประกันสุขภาพบิดามารดา", note: "ไม่เกิน 15,000 บาท", remaining: Math.max(0, calc.parentHealthCap - calc.dParentHealth), group: false },
    { key: "annuity", label: "ประกันชีวิตแบบบำนาญ", note: `15% ของเงินได้ (${fmt(calc.income40)}) ไม่เกิน 200,000 — อยู่ในกลุ่มเกษียณที่มีเพดานรวม 500,000 บาทด้วย`, remaining: Math.max(0, calc.annuityCap - calc.dAnnuityFinal), group: true },
    { key: "pvd", label: "กองทุนสำรองเลี้ยงชีพ/กบข.", note: "ไม่เกิน 15% ของเงินได้ หรือ 500,000 — อยู่ในกลุ่มเกษียณที่มีเพดานรวม 500,000 บาทด้วย", remaining: Math.max(0, calc.pvdCap - calc.dPvdFinal), group: true },
    { key: "rmf", label: "RMF — กองทุนรวมเพื่อการเลี้ยงชีพ", note: "30% ของเงินได้ ไม่เกิน 500,000 — อยู่ในกลุ่มเกษียณที่มีเพดานรวม 500,000 บาทด้วย", remaining: Math.max(0, calc.rmfCap - calc.dRmfFinal), group: true },
    { key: "ssf", label: "SSF — กองทุนรวมเพื่อการออม (หมดสิทธิ์ตั้งแต่ปี 2567 — ไม่แสดงเป็นตัวเลือกซื้อเพิ่ม)", note: "", remaining: 0, group: true, disabled: true },
    { key: "nsf", label: "กอช. — กองทุนการออมแห่งชาติ", note: "ไม่เกิน 30,000 บาท — อยู่ในกลุ่มเกษียณที่มีเพดานรวม 500,000 บาทด้วย", remaining: calc.nsfIneligible ? 0 : Math.max(0, calc.nsfCap - calc.dNsfFinal), group: true },
    { key: "teacherFund", label: "กองทุนสงเคราะห์ครูโรงเรียนเอกชน", note: "15% ของเงินได้ ไม่เกิน 500,000 — เฉพาะครูโรงเรียนเอกชน อยู่ในกลุ่มเกษียณที่มีเพดานรวม 500,000 บาทด้วย", remaining: Math.max(0, calc.teacherFundCap - calc.dTeacherFundFinal), group: true },
    { key: "tesg", label: "กองทุนรวมไทยเพื่อความยั่งยืน (Thai ESG)", note: "30% ของเงินได้ ไม่เกิน 300,000 บาท — แยกเพดานต่างหาก ไม่รวมกับกลุ่มเกษียณ 500,000", remaining: Math.max(0, calc.tesgCap - calc.dTesg), group: false },
    { key: "thaiesgx", label: "Thai ESGX", note: "เฉพาะผู้ที่สับเปลี่ยน LTF เดิมช่วง พ.ค.-มิ.ย. 2568 แล้ว — เพดานปี 2569 คงที่ 50,000 บาท แยกต่างหาก", remaining: Math.max(0, calc.thaiesgxCap - calc.dThaiesgx), group: false },
  ].filter((i) => i.remaining > 0.5);

  const togglePlanItem = (item) => {
    setPlanItems((prev) => {
      const next = { ...prev };
      if (item.key in next) {
        delete next[item.key];
      } else {
        next[item.key] = String(Math.round(item.remaining));
      }
      return next;
    });
  };
  const selectedItems = purchasableItems.filter((i) => i.key in planItems);

  // จำลองซื้อเพิ่มจริงผ่าน buildCalc เดียวกับที่ใช้คำนวณทั้งแอป — เพดานรวมกลุ่มเกษียณ 500,000 บาท
  // จะถูกตรวจสอบและปรับลดสัดส่วนให้อัตโนมัติเหมือนช่องกรอกค่าลดหย่อนปกติ ไม่มีทางหลุดเพดานไปได้
  const PLAN_FIELD_MAP = { lifehealth: "lifeInsurance", parenthealth: "parentHealthInsurance", annuity: "annuityInsurance", pvd: "pvd", rmf: "rmf", ssf: "ssf", nsf: "nsf", teacherFund: "teacherFund", tesg: "tesg", thaiesgx: "thaiesgx" };
  const plannedDed = { ...ded };
  selectedItems.forEach((item) => {
    const field = PLAN_FIELD_MAP[item.key];
    const addAmt = Math.min(num(planItems[item.key]), item.remaining);
    plannedDed[field] = String(num(ded[field]) + addAmt);
  });
  const calcPlanned = buildCalc(income, plannedDed);
  const planAddNum = Math.max(0, calcPlanned.totalDeductions - calc.totalDeductions); // ยอดที่ใช้สิทธิ์ได้จริงหลังผ่านทุกเพดานแล้ว

  const afterPlanFinalTax = trueTax(calcPlanned);
  const taxSaved = Math.max(0, calcTrueTax - afterPlanFinalTax);

  // เช็คเพดานรวมกลุ่มเกษียณโดยเฉพาะ เผื่อเลือกซื้อหลายตัวในกลุ่มเดียวกันจนรวมกันเกิน 500,000 บาท
  const groupSelectedRaw = selectedItems.filter((i) => i.group).reduce((s, i) => s + Math.min(num(planItems[i.key]), i.remaining), 0);
  const groupActualAdded = Math.max(0, calcPlanned.retirementGroupTotal - calc.retirementGroupTotal);
  const groupCutByCap = Math.max(0, groupSelectedRaw - groupActualAdded);

  // สมมติว่าประหยัดภาษีจำนวนเท่ากันนี้ทุกปี แล้วนำไปลงทุนสะสมทุกปีจนถึงวัยเกษียณ (future value of an ordinary annuity)
  const totalContributed = taxSaved * years;
  const futureValueAnnuity = years <= 0 ? 0 : (rate === 0 ? totalContributed : taxSaved * ((Math.pow(1 + rate, years) - 1) / rate));
  const growthExtra = Math.max(0, futureValueAnnuity - totalContributed);

  const effectiveRate = calc.incomeAfterExpense > 0 ? (calc.finalTax / calc.incomeAfterExpense) * 100 : 0;

  return (
    <div data-printmode={printMode} style={{ fontFamily: "'Noto Sans Thai', sans-serif", background: "#EAF6F5", minHeight: "100vh", color: "#0D1826", fontSize: 18 }}>
      <style>{`
        ${FONT_IMPORT}
        * { box-sizing: border-box; }
        .serif { font-family: 'Noto Serif Thai', serif; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .field-input {
          width: 100%; padding: 15px 16px; border: 2px solid #2C6FA8; border-radius: 4px;
          font-family: 'IBM Plex Mono', monospace; font-size: 22px; background: #FFFFFF;
          color: #0D1826; transition: border-color .15s, box-shadow .15s; font-weight: 500;
        }
        .field-input:focus { outline: none; border-color: #0B3D78; box-shadow: 0 0 0 4px rgba(122,90,15,0.18); }
        .select-input {
          width: 100%; padding: 14px 12px; border: 2px solid #2C6FA8; border-radius: 4px;
          font-family: 'Noto Sans Thai', sans-serif; font-size: 18px; background: #FFFFFF; color: #0D1826; font-weight: 500;
        }
        .sec-card {
          background: #FFFFFF; border: 2px solid #A9D8E8; border-radius: 8px; padding: 26px 26px;
          margin-bottom: 20px;
        }
        .collapse-wrap {
          display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.35s ease;
        }
        .collapse-wrap.open { grid-template-rows: 1fr; }
        .collapse-inner { overflow: hidden; min-height: 0; }
        .row2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; align-items: end; }
        @media (max-width: 720px) { .row2 { grid-template-columns: 1fr; } }
        .label-sm { font-size: 17px; color: #0B3D78; margin-bottom: 8px; display: block; font-weight: 700; }
        .checkbox-row { display: flex; align-items: center; gap: 10px; font-size: 18px; color: #0D1826; cursor: pointer; margin-top: 10px; font-weight: 600; }
        .checkbox-row input { width: 20px; height: 20px; }
        .rule-text { margin-top: 10px; font-size: 16px; color: #0B3D78; line-height: 1.7; font-weight: 500; }
        .excess-box {
          margin-top: 10px; font-size: 16.5px; font-weight: 700; color: #FFFFFF; background: #8A241C;
          border-radius: 5px; padding: 12px 15px; line-height: 1.6;
        }
        .remaining-box {
          margin-top: 10px; font-size: 16.5px; font-weight: 700; color: #FFFFFF; background: #1F6B3D;
          border-radius: 5px; padding: 12px 15px; line-height: 1.6;
        }
        .full-box {
          margin-top: 10px; font-size: 16.5px; font-weight: 700; color: #17406B; background: #DCEBF7;
          border: 2px solid #17406B; border-radius: 5px; padding: 12px 15px; line-height: 1.6;
        }
        ::-webkit-scrollbar { width: 10px; } ::-webkit-scrollbar-thumb { background: #7FBFDD; border-radius: 5px; }
        @media print {
          body * { visibility: hidden; }
          [data-printmode="summary"] #print-area, [data-printmode="summary"] #print-area * { visibility: visible; }
          [data-printmode="summary"] #print-area { display: block !important; position: absolute; left: 0; top: 0; width: 100%; padding: 10px 0; }
          [data-printmode="investment"] #print-area-investment, [data-printmode="investment"] #print-area-investment * { visibility: visible; }
          [data-printmode="investment"] #print-area-investment { display: block !important; position: absolute; left: 0; top: 0; width: 100%; padding: 10px 0; }
        }
      `}</style>

      {/* ---------- Header ---------- */}
      <header style={{ background: "#0B3D78", color: "#FBFAF3", padding: "40px 24px 34px" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <img
              src={APP_LOGO_URI}
              alt="Tax By Ped"
              style={{ width: "clamp(68px,11vw,116px)", height: "clamp(68px,11vw,116px)", borderRadius: "50%", border: "2.5px solid #A9E0A0", flexShrink: 0, objectFit: "cover", marginTop: 2 }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", rowGap: 6 }}>
                <span className="mono" style={{ fontSize: "clamp(13px,2.2vw,16px)", letterSpacing: 1.5, color: "#A9E0A0", border: "2px solid #3D7FB8", padding: "4px 10px", borderRadius: 4, fontWeight: 700, whiteSpace: "nowrap" }}>
                  ภ.ง.ด. 90 / 91 · ปีภาษี 2569
                </span>
                <span className="mono" style={{ fontSize: "clamp(12px,2vw,15px)", color: "#BFE3F0", fontWeight: 500, whiteSpace: "nowrap" }}>สำหรับยื่นในปี 2570</span>
              </div>
              <h1 className="serif" style={{ fontSize: "clamp(22px,4.5vw,40px)", margin: "10px 0 0", fontWeight: 700, lineHeight: 1.25 }}>
                แบบคำนวณภาษีเงินได้บุคคลธรรมดา
              </h1>
            </div>
          </div>
          <div style={{ fontSize: 14.5, color: "#A9E0A0", fontWeight: 700, margin: "16px 0 10px" }}>
            จัดทำโดยป้าเป็ด CFP — เพื่อใช้ภายในทีมงานสำหรับความสะดวกในการวางแผนภาษีเบื้องต้น
          </div>
          <p style={{ fontSize: 19, color: "#DCEFFA", maxWidth: 720, lineHeight: 1.7, fontWeight: 500 }}>
            คำนวณเงินได้ทุกประเภทตามมาตรา 40 หักค่าใช้จ่ายและค่าลดหย่อนครบตามสิทธิ พร้อมแจ้งเพดานที่ใช้ได้จริงของแต่ละรายการ
            และเปรียบเทียบแผนภาษีปัจจุบันกับแผนใช้สิทธิ์เต็มจำนวน
          </p>
          <button
            onClick={clearAllData}
            style={{
              marginTop: 18, background: confirmClear ? "#F0A8A0" : "#A9E0A0", color: "#0B3D78",
              border: `2px solid ${confirmClear ? "#8A241C" : "#1B5E3A"}`,
              borderRadius: 6, padding: "12px 22px", fontSize: 16, fontWeight: 800, cursor: "pointer",
              fontFamily: "'Noto Sans Thai', sans-serif",
            }}
          >
            {confirmClear ? "⚠ แตะอีกครั้งเพื่อยืนยันการล้างข้อมูล" : "↺ ล้างข้อมูลทั้งหมด"}
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "30px 20px 90px" }}>

        <div>
          {/* ---- ข้อมูลผู้เสียภาษี ---- */}
          <SectionTitle n="0" title="ข้อมูลผู้เสียภาษี" sub="ใช้สำหรับบันทึกข้อมูลและคำนวณระยะเวลาการลงทุนถึงวัยเกษียณ" />
          <div className="sec-card">
            <div className="row2">
              <div>
                <label className="label-sm">ชื่อ-นามสกุล</label>
                <input className="field-input" style={{ fontSize: 18 }} type="text" value={taxpayerName} onFocus={handleTapClear} onKeyDown={handleEnterToNext} onInput={(e) => setTaxpayerName(e.target.value)} placeholder="ระบุชื่อ" />
              </div>
              <div>
                <label className="label-sm">อายุปัจจุบัน (ปี)</label>
                <NumField value={ded.age} onChange={(v) => setDed({ ...ded, age: v })} placeholder="0" />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label className="label-sm">อายุที่วางแผนจะเกษียณ (ปี)</label>
              <NumField value={retireAge} onChange={(v) => setRetireAge(v)} placeholder="60" />
            </div>
            <label className="checkbox-row" style={{ marginTop: 16 }}>
              <input type="checkbox" checked={ded.selfDisabled} onChange={(e) => setDed({ ...ded, selfDisabled: e.target.checked })} />
              ตนเองเป็นผู้พิการ (มีบัตรประจำตัวคนพิการ)
            </label>
            {calc.elderlyOrDisabled && (
              <div className="full-box" style={{ marginTop: 10 }}>
                {num(ded.age) >= 65 ? "อายุ 65 ปีขึ้นไป" : "เป็นผู้พิการที่มีบัตรประจำตัวคนพิการ"} — ได้รับสิทธิยกเว้นเงินได้ 190,000 บาทแรกโดยอัตโนมัติ (คำนวณได้ {fmt(calc.elderlyDisabledExemption)} บาท)
              </div>
            )}

            <div style={{ marginTop: 18, paddingTop: 18, borderTop: "2px solid #A9D8E8" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0B3D78", background: "#DCEBF7", borderRadius: 4, padding: "3px 9px", display: "inline-block", marginBottom: 10 }}>
                ข้อมูลผู้ให้คำปรึกษา — ใช้แสดงบนเอกสารที่พิมพ์ให้ลูกค้าเท่านั้น
              </div>
              <div className="row2">
                <div>
                  <label className="label-sm">ชื่อผู้ให้คำปรึกษา</label>
                  <input className="field-input" style={{ fontSize: 18 }} type="text" value={advisorName} onFocus={handleTapClear} onKeyDown={handleEnterToNext} onInput={(e) => setAdvisorName(e.target.value)} placeholder="เช่น ป้าเป็ด CFP" />
                </div>
                <div>
                  <label className="label-sm">เบอร์โทรติดต่อ</label>
                  <input className="field-input" style={{ fontSize: 18 }} type="text" value={advisorPhone} onFocus={handleTapClear} onKeyDown={handleEnterToNext} onInput={(e) => setAdvisorPhone(e.target.value)} placeholder="เช่น 08X-XXX-XXXX" />
                </div>
              </div>
            </div>

          </div>

          {/* ---- จัดการเคสลูกค้า ---- */}
          <div className="sec-card">
            <button
              onClick={() => setShowCaseManager((v) => !v)}
              style={{
                width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Noto Sans Thai', sans-serif",
                fontSize: 17, fontWeight: 800, color: "#0B3D78",
              }}
            >
              <span>📁 จัดการเคสลูกค้า (บันทึก/โหลด)</span>
              <span>{showCaseManager ? "▲" : "▼"}</span>
            </button>
            {showCaseManager && (
              <div style={{ marginTop: 16 }}>
                <div className="rule-text" style={{ marginBottom: 10 }}>
                  บันทึกข้อมูลทั้งหมดที่กรอกไว้ตอนนี้ (รายได้ ค่าลดหย่อน รายการที่เลือก) เป็นเคสแยกตามชื่อลูกค้า เก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น — โหลดกลับมาดู/แก้ไขทีหลังได้
                </div>
                <div className="row2">
                  <div>
                    <label className="label-sm">ชื่อเคส (เช่น ชื่อลูกค้า)</label>
                    <input
                      className="field-input" style={{ fontSize: 18 }} type="text"
                      value={caseNameInput} onFocus={handleTapClear}
                      onInput={(e) => setCaseNameInput(e.target.value)}
                      placeholder="เช่น คุณสมชาย ใจดี"
                    />
                  </div>
                  <button
                    onClick={saveCurrentCase}
                    disabled={!caseNameInput.trim()}
                    style={{
                      padding: "14px 18px", borderRadius: 6, cursor: caseNameInput.trim() ? "pointer" : "not-allowed",
                      fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 16, fontWeight: 800,
                      border: "2px solid #0B3D78", background: caseNameInput.trim() ? "#0B3D78" : "#CFE8F0",
                      color: caseNameInput.trim() ? "#FFFFFF" : "#7A93A8", height: "fit-content", alignSelf: "end",
                    }}
                  >
                    บันทึกเป็นเคสใหม่
                  </button>
                </div>
                {caseMsg && <div className="remaining-box" style={{ marginTop: 10 }}>{caseMsg}</div>}

                {savedCases.length > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#0B3D78", marginBottom: 10 }}>เคสที่บันทึกไว้ ({savedCases.length})</div>
                    {savedCases.map((name) => (
                      <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0", borderBottom: "1px solid #EAF1F5" }}>
                        <span style={{ fontSize: 16, color: "#14314F", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          <button
                            onClick={() => loadCase(name)}
                            style={{ padding: "8px 14px", borderRadius: 5, cursor: "pointer", fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 14, fontWeight: 700, border: "2px solid #0B3D78", background: "#DCEBF7", color: "#0B3D78" }}
                          >
                            โหลด
                          </button>
                          <button
                            onClick={() => deleteCase(name)}
                            style={{ padding: "8px 14px", borderRadius: 5, cursor: "pointer", fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 14, fontWeight: 700, border: "2px solid #8A241C", background: "#F9E9E7", color: "#8A241C" }}
                          >
                            ลบ
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ---- แท็บสลับ: เลือกรายการ / กรอกข้อมูล+คำนวณ ---- */}
          <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
            <button
              onClick={() => setActiveTab("select")}
              style={{
                flex: 1, padding: "14px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "'Noto Sans Thai', sans-serif",
                fontSize: 17, fontWeight: 800, border: activeTab === "select" ? "2.5px solid #0B3D78" : "2px solid #CFE8F0",
                background: activeTab === "select" ? "#0B3D78" : "#FFFFFF", color: activeTab === "select" ? "#FFFFFF" : "#0B3D78",
              }}
            >
              1. เลือกรายการ
            </button>
            <button
              onClick={goToFillTab}
              style={{
                flex: 1, padding: "14px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "'Noto Sans Thai', sans-serif",
                fontSize: 17, fontWeight: 800, border: activeTab === "fill" ? "2.5px solid #0B3D78" : "2px solid #CFE8F0",
                background: activeTab === "fill" ? "#0B3D78" : "#FFFFFF", color: activeTab === "fill" ? "#FFFFFF" : "#0B3D78",
              }}
            >
              2. กรอกข้อมูล + คำนวณ
            </button>
          </div>

          {activeTab === "select" && (
            <div>
              <SectionTitle n="1" title="เลือกรายการที่เกี่ยวข้องกับคุณ" sub="ติ๊กเฉพาะรายได้และค่าลดหย่อนที่คุณมีจริง — แท็บถัดไปจะโชว์เฉพาะที่เลือกไว้เท่านั้น ไม่ต้องไล่ดูรายการที่ไม่เกี่ยวกับคุณ" />
              <div className="sec-card">
                <div style={{ fontWeight: 800, fontSize: 19, color: "#0B3D78", marginBottom: 6 }}>เริ่มจากเทมเพลตกลุ่มลูกค้า (ไม่บังคับ)</div>
                <div className="rule-text" style={{ marginBottom: 14 }}>เลือกแล้วติ๊กรายการที่มักเกี่ยวข้องให้อัตโนมัติ — ยังปรับเพิ่ม/ลดทีหลังได้เสมอ</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {TEMPLATE_DEFS.map((tpl) => {
                    const isSel = selectedTemplate === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        onClick={() => applyTemplate(tpl)}
                        style={{
                          flex: "1 1 140px", padding: "12px 10px", borderRadius: 6, cursor: "pointer",
                          fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 15, fontWeight: 800,
                          border: isSel ? "2.5px solid #0B3D78" : "2px solid #CFE8F0",
                          background: isSel ? "#0B3D78" : "#FFFFFF", color: isSel ? "#FFFFFF" : "#0B3D78",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        }}
                      >
                        {isSel && <span>✓</span>}
                        {tpl.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="sec-card">
                <div style={{ fontWeight: 800, fontSize: 19, color: "#0B3D78", marginBottom: 14 }}>รายได้</div>
                {GROUP_DEFS.filter((g) => g.section === "income").map((g) => (
                  <GroupCheckbox key={g.id} group={g} selectedGroups={selectedGroups} toggleGroup={toggleGroup} selectedSubItems={selectedSubItems} toggleSubItem={toggleSubItem} />
                ))}
              </div>
              <div className="sec-card">
                <div style={{ fontWeight: 800, fontSize: 19, color: "#0B3D78", marginBottom: 14 }}>ค่าลดหย่อน</div>
                {GROUP_DEFS.filter((g) => g.section === "deduction").map((g) => (
                  <GroupCheckbox key={g.id} group={g} selectedGroups={selectedGroups} toggleGroup={toggleGroup} selectedSubItems={selectedSubItems} toggleSubItem={toggleSubItem} />
                ))}
              </div>
              <button
                onClick={goToFillTab}
                disabled={!anySelected}
                style={{
                  width: "100%", padding: "16px 18px", borderRadius: 8, cursor: anySelected ? "pointer" : "not-allowed",
                  fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 18, fontWeight: 800,
                  border: "2px solid #0B3D78", background: anySelected ? "#0B3D78" : "#CFE8F0", color: anySelected ? "#FFFFFF" : "#7A93A8",
                  marginTop: 6,
                }}
              >
                ไปกรอกข้อมูล + คำนวณ →
              </button>
              {!anySelected && <div className="rule-text" style={{ marginTop: 8, textAlign: "center" }}>เลือกอย่างน้อย 1 รายการก่อนถึงจะไปต่อได้</div>}
            </div>
          )}

          {activeTab === "fill" && (
          <div ref={tab2Ref}>
          <div style={{ background: "#FFFFFF", border: "2px solid #CFE8F0", borderRadius: 8, padding: "14px 18px", marginBottom: 20 }}>
            <button
              onClick={() => setShowAddMore((v) => !v)}
              style={{
                width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Noto Sans Thai', sans-serif",
                fontSize: 17, fontWeight: 800, color: "#0B3D78",
              }}
            >
              <span>+ เพิ่มรายการอื่น</span>
              <span style={{ fontSize: 18 }}>{showAddMore ? "▲" : "▼"}</span>
            </button>
            {showAddMore && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#0B3D78", marginBottom: 10 }}>รายได้</div>
                {GROUP_DEFS.filter((g) => g.section === "income").map((g) => (
                  <GroupCheckbox key={g.id} group={g} selectedGroups={selectedGroups} toggleGroup={toggleGroup} selectedSubItems={selectedSubItems} toggleSubItem={toggleSubItem} />
                ))}
                <div style={{ fontWeight: 800, fontSize: 16, color: "#0B3D78", margin: "14px 0 10px" }}>ค่าลดหย่อน</div>
                {GROUP_DEFS.filter((g) => g.section === "deduction").map((g) => (
                  <GroupCheckbox key={g.id} group={g} selectedGroups={selectedGroups} toggleGroup={toggleGroup} selectedSubItems={selectedSubItems} toggleSubItem={toggleSubItem} />
                ))}
              </div>
            )}
          </div>

          {/* ---- ส่วนที่ 1: เงินได้ ---- */}
          <SectionTitle n="1" title="เงินได้พึงประเมิน" sub="ระบุเงินได้แต่ละประเภทตามมาตรา 40 — ระบบจะหักค่าใช้จ่ายให้อัตโนมัติ" />

          {selectedGroups.inc_1_2 && (
          <StaticCard en="40(1)+(2)" th="เงินเดือน ค่าจ้าง โบนัส เบี้ยประชุม ค่านายหน้า">
            <div className="row2">
              <div>
                <label className="label-sm">เงินเดือน/ค่าจ้าง/โบนัส ตลอดปี (บาท)</label>
                <NumField value={income.salary} onChange={(v) => setIncome({ ...income, salary: v })} placeholder="0" />
              </div>
              <div>
                <label className="label-sm">ค่านายหน้า/เบี้ยประชุม/ค่าธรรมเนียม (บาท)</label>
                <NumField value={income.commission} onChange={(v) => setIncome({ ...income, commission: v })} placeholder="0" />
              </div>
            </div>
            <div className="rule-text">หักค่าใช้จ่ายเหมา 50% รวมกันสูงสุดไม่เกิน 100,000 บาท — คำนวณได้ {fmt(calc.exp12)} บาท</div>
            <WhtField value={income.whtSalary} onChange={(v) => setIncome({ ...income, whtSalary: v })} />
          </StaticCard>
          )}

          {/* สวัสดิการกรรมการ ย้ายไปแสดงหลังสรุปผลการคำนวณด้านล่าง (ดูส่วน "สวัสดิการกรรมการ" ท้ายหน้าสรุป) */}

          {selectedGroups.inc_3 && (
          <StaticCard en="40(3)" th="ค่าลิขสิทธิ์">
            <label className="label-sm">ค่าแห่งลิขสิทธิ์ (บาท)</label>
            <NumField value={income.royalty} onChange={(v) => setIncome({ ...income, royalty: v })} placeholder="0" />
            <div className="rule-text">หักเหมา 50% ไม่เกิน 100,000 บาท — คำนวณได้ {fmt(calc.exp3)} บาท</div>
            <WhtField value={income.whtRoyalty} onChange={(v) => setIncome({ ...income, whtRoyalty: v })} />
          </StaticCard>
          )}

          {selectedGroups.inc_4a && (
          <StaticCard en="40(4)ก" th="ดอกเบี้ย">
            <label className="label-sm">ดอกเบี้ยที่ได้รับตลอดปี — ยอดก่อนหักภาษี ณ ที่จ่าย (บาท)</label>
            <NumField value={income.interestAmt} onChange={(v) => setIncome({ ...income, interestAmt: v })} placeholder="0" />
            <div className="rule-text">
              กรอกยอดเงินได้ก่อนหักภาษี (ตามหนังสือรับรองการหักภาษี ณ ที่จ่ายที่ธนาคาร/ผู้จ่ายออกให้) ไม่ใช่ยอดที่โอนเข้าบัญชีจริงหลังหักแล้ว — แอปจะคำนวณภาษีที่ถูกหักไปให้เองด้านล่าง ไม่ต้องกรอกแยก
            </div>

            <div style={{ marginTop: 12 }}>
              <label className="label-sm">อัตราภาษีหัก ณ ที่จ่าย (%)</label>
              <select className="select-input" value={income.interestWhtRate} onChange={(e) => setIncome({ ...income, interestWhtRate: e.target.value })}>
                <option value="15">15% — มาตรฐานทั่วไป (ดอกเบี้ยเงินฝากออมทรัพย์/ประจำ, พันธบัตรทั่วไป)</option>
                <option value="10">10% — บางกรณีเฉพาะ (ตรวจสอบจากหนังสือรับรอง)</option>
                <option value="0">0% — ไม่ถูกหักภาษี (เช่น ดอกเบี้ยออมทรัพย์ที่ได้รับยกเว้นตามเงื่อนไข)</option>
              </select>
              <div className="rule-text">ถ้าไม่แน่ใจให้ใช้ 15% (มาตรฐานส่วนใหญ่) เว้นแต่หนังสือรับรองการหักภาษี ณ ที่จ่ายระบุอัตราอื่นไว้ชัดเจน</div>
            </div>

            <div className="rule-text">ดอกเบี้ยหักค่าใช้จ่ายไม่ได้</div>
            <ul style={{ margin: "6px 0 0", paddingLeft: 20, fontSize: 14, color: "#14314F", lineHeight: 1.6 }}>
              <li style={{ marginBottom: 6 }}><b>ไม่รวมคำนวณ (Final Tax):</b> ภาษีที่หักไปแล้วถือเป็นภาษีสุดท้าย จบไม่ต้องยื่นเพิ่ม</li>
              <li><b>รวมคำนวณ:</b> ต้องนำดอกเบี้ยเต็มจำนวนไปรวมเป็นเงินได้ แต่จะได้เครดิตภาษีที่หักไปแล้วคืนกลับมาช่วยหักภาษีที่คำนวณได้ — เหมาะกับคนที่ฐานภาษีต่ำกว่าอัตราที่ถูกหักไว้ เพราะจะได้เงินคืน</li>
            </ul>
            {num(income.interestAmt) > 0 && (
              <div className="rule-text" style={{ marginTop: 16 }}>
                กรอกข้อมูลที่นี่พอ — เลือกวิธีคำนวณ (ไม่รวมคำนวณ / รวมคำนวณ) ได้ที่กล่องสรุปผลด้านบน ซึ่งเป็นขั้นตอนตัดสินใจจริง
              </div>
            )}
          </StaticCard>
          )}

          {selectedGroups.inc_4b && (
          <StaticCard en="40(4)ข" th="เงินปันผล">
            <label className="label-sm">เงินปันผลที่ได้รับตลอดปี — ยอดที่ประกาศจ่าย ก่อนหักภาษี ณ ที่จ่าย (บาท)</label>
            <NumField value={income.dividendAmt} onChange={(v) => setIncome({ ...income, dividendAmt: v })} placeholder="0" />
            <div className="rule-text">
              กรอกยอดเงินได้ก่อนหักภาษี (ตามหนังสือรับรองการหักภาษี ณ ที่จ่าย 50 ทวิ) ไม่ใช่ยอดที่โอนเข้าบัญชีจริงหลังหักแล้ว — แอปคำนวณภาษีที่ถูกหักไปให้เองด้านล่าง ไม่ต้องกรอกแยก
            </div>

            <div style={{ marginTop: 12 }}>
              <label className="label-sm">อัตราภาษีหัก ณ ที่จ่ายของเงินปันผล (%)</label>
              <select className="select-input" value={income.dividendWhtRate} onChange={(e) => setIncome({ ...income, dividendWhtRate: e.target.value })}>
                <option value="10">10% — มาตรฐานทั่วไป (เงินปันผลบริษัททั่วไป)</option>
                <option value="0">0% — ไม่ถูกหักภาษี (บางกรณีเฉพาะ)</option>
              </select>
              <div className="rule-text">ถ้าไม่แน่ใจให้ใช้ 10% (มาตรฐานเกือบทุกกรณี) เว้นแต่หนังสือรับรอง 50 ทวิ ระบุอัตราอื่นไว้ชัดเจน</div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label className="label-sm">อัตราภาษีเงินได้นิติบุคคลที่บริษัทผู้จ่ายปันผลเสียจริง (%) — ใช้คำนวณเครดิตภาษี</label>
              <select className="select-input" value={income.corpTaxRate} onChange={(e) => setIncome({ ...income, corpTaxRate: e.target.value })}>
                <option value="20">20% — อัตรานิติบุคคลทั่วไป (ส่วนใหญ่)</option>
                <option value="15">15% — SME/BOI บางกรณี</option>
                <option value="10">10% — กิจการที่ได้รับสิทธิพิเศษ</option>
                <option value="0">0% — ได้รับยกเว้นภาษีนิติบุคคล (เช่น BOI เต็มจำนวน)</option>
              </select>
              <div className="rule-text">ตรวจสอบอัตราที่แท้จริงได้จากหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) ที่แนบมากับเงินปันผล ถ้าไม่ทราบ ส่วนใหญ่ใช้ 20%</div>
              <div style={{ marginTop: 10, fontSize: 12.5, color: "#6C93A8", lineHeight: 1.7 }}>
                หมายเหตุ: เครดิตภาษีตามมาตรา 47 ทวิ ใช้ได้เฉพาะเงินปันผลจากบริษัทที่จดทะเบียนจัดตั้งตามกฎหมายไทยที่เสียภาษีนิติบุคคลแล้วเท่านั้น (ไม่รวมเงินปันผลจากต่างประเทศหรือกองทุนที่ได้รับยกเว้น) และผู้มีเงินได้ต้องเป็นผู้มีถิ่นที่อยู่ทางภาษีในประเทศไทย
              </div>
            </div>

            {calc.sDividend > 0 && (
              <div className="rule-text" style={{ marginTop: 16 }}>
                กรอกข้อมูลที่นี่พอ — เลือกวิธีคำนวณ (ไม่ใช้เครดิต / ใช้เครดิตภาษี) ได้ที่กล่องสรุปผลด้านขวา (ด้านบนสุด) ซึ่งเป็นขั้นตอนตัดสินใจจริง
              </div>
            )}
          </StaticCard>
          )}

          {selectedGroups.inc_5 && (
          <StaticCard en="40(5)" th="ค่าเช่าทรัพย์สิน">
            <div className="row2">
              <div>
                <label className="label-sm">ค่าเช่าที่ได้รับตลอดปี (บาท)</label>
                <NumField value={income.rentalAmt} onChange={(v) => setIncome({ ...income, rentalAmt: v })} placeholder="0" />
              </div>
              <div>
                <label className="label-sm">ประเภททรัพย์สิน</label>
                <select className="select-input" value={income.rentalType} onChange={(e) => setIncome({ ...income, rentalType: e.target.value })} disabled={income.rentalActual}>
                  {RENTAL_TYPES.map((r) => <option key={r.key} value={r.key}>{r.label} ({r.rate}%)</option>)}
                </select>
              </div>
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={income.rentalActual} onChange={(e) => setIncome({ ...income, rentalActual: e.target.checked })} />
              หักค่าใช้จ่ายตามจริง (แทนอัตราเหมา)
            </label>
            {income.rentalActual && (
              <div style={{ marginTop: 12 }}>
                <label className="label-sm">ค่าใช้จ่ายจริงที่มีหลักฐาน (บาท)</label>
                <NumField value={income.rentalActualAmt} onChange={(v) => setIncome({ ...income, rentalActualAmt: v })} placeholder="0" />
              </div>
            )}
            <div className="rule-text">หักค่าใช้จ่ายได้ {fmt(calc.exp5)} บาท</div>
            <WhtField value={income.whtRental} onChange={(v) => setIncome({ ...income, whtRental: v })} />
          </StaticCard>
          )}

          {selectedGroups.inc_6 && (
          <StaticCard en="40(6)" th="วิชาชีพอิสระ">
            <div className="row2">
              <div>
                <label className="label-sm">รายได้จากวิชาชีพอิสระ (บาท)</label>
                <NumField value={income.profAmt} onChange={(v) => setIncome({ ...income, profAmt: v })} placeholder="0" />
              </div>
              <div>
                <label className="label-sm">ประเภทวิชาชีพ</label>
                <select className="select-input" value={income.profType} onChange={(e) => setIncome({ ...income, profType: e.target.value })} disabled={income.profActual}>
                  {PROFESSION_TYPES.map((p) => <option key={p.key} value={p.key}>{p.label} ({p.rate}%)</option>)}
                </select>
              </div>
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={income.profActual} onChange={(e) => setIncome({ ...income, profActual: e.target.checked })} />
              หักค่าใช้จ่ายตามจริง (แทนอัตราเหมา)
            </label>
            {income.profActual && (
              <div style={{ marginTop: 12 }}>
                <label className="label-sm">ค่าใช้จ่ายจริงที่มีหลักฐาน (บาท)</label>
                <NumField value={income.profActualAmt} onChange={(v) => setIncome({ ...income, profActualAmt: v })} placeholder="0" />
              </div>
            )}
            <div className="rule-text">หักค่าใช้จ่ายได้ {fmt(calc.exp6)} บาท</div>
            <WhtField value={income.whtProf} onChange={(v) => setIncome({ ...income, whtProf: v })} />
          </StaticCard>
          )}

          {selectedGroups.inc_78 && (
          <StaticCard en="40(7)+(8)" th="ธุรกิจ พาณิชย์ รับเหมา และเงินได้อื่นๆ">
            <div className="row2">
              <div>
                <label className="label-sm">รายได้จากธุรกิจ/รับเหมา/อื่นๆ (บาท)</label>
                <NumField value={income.bizAmt} onChange={(v) => setIncome({ ...income, bizAmt: v })} placeholder="0" />
              </div>
              <div>
                <label className="label-sm">ลักษณะเงินได้</label>
                <select className="select-input" value={income.bizType} onChange={(e) => setIncome({ ...income, bizType: e.target.value })} disabled={income.bizActual}>
                  {BIZ78_TYPES.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.label}{typeof b.rate === "number" ? ` (${b.rate}%)` : b.rate === "tier" ? " (60%/40%)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={income.bizActual} onChange={(e) => setIncome({ ...income, bizActual: e.target.checked })} />
              หักค่าใช้จ่ายตามจริง (แทนอัตราเหมา)
            </label>
            {income.bizActual && (
              <div style={{ marginTop: 12 }}>
                <label className="label-sm">ค่าใช้จ่ายจริงที่มีหลักฐาน (บาท)</label>
                <NumField value={income.bizActualAmt} onChange={(v) => setIncome({ ...income, bizActualAmt: v })} placeholder="0" />
              </div>
            )}
            <WhtField value={income.whtBiz} onChange={(v) => setIncome({ ...income, whtBiz: v })} />
            <div className="rule-text">
              {income.bizType === "performer_tier" && !income.bizActual ? "นักแสดงสาธารณะ: 300,000 บาทแรกหัก 60% ส่วนที่เกินหัก 40% — " : null}
              หักค่าใช้จ่ายได้ {fmt(calc.exp78)} บาท
            </div>
          </StaticCard>
          )}

          {selectedGroups.inc_lumpsum && (
          <StaticCard en="48(5)" th="เงินได้ออกจากงานครั้งเดียว (บำเหน็จ/PVD) — แยกยื่นภาษีต่างหาก">
            <div className="rule-text" style={{ marginBottom: 14 }}>
              เงินชดเชยจากนายจ้าง / เงินสะสม+สมทบจากกองทุนสำรองเลี้ยงชีพ (PVD) ที่ได้รับครั้งเดียวเพราะออกจากงาน — กฎหมายให้สิทธิ์<b>เลือกแยกยื่นภาษีต่างหาก</b>จากเงินได้ปกติ (ยื่นเป็นใบแนบ) มักเสียภาษีน้อยกว่ารวมกับเงินเดือนปกติมาก เพราะมีค่าใช้จ่ายพิเศษให้หักตามอายุงาน — คำนวณแยกจากส่วนอื่นทั้งหมดของแอปนี้ ไม่ปนกับเงินได้ปกติด้านบน
            </div>
            <div className="row2">
              <div>
                <label className="label-sm">จำนวนเงินที่ได้รับทั้งก้อน (บาท)</label>
                <NumField value={income.lumpSumAmt} onChange={(v) => setIncome({ ...income, lumpSumAmt: v })} placeholder="0" />
              </div>
              <div>
                <label className="label-sm">จำนวนปีที่ทำงาน (ปี)</label>
                <NumField value={income.lumpSumYears} onChange={(v) => setIncome({ ...income, lumpSumYears: v })} placeholder="0" />
              </div>
            </div>
            <div className="rule-text" style={{ marginTop: 4 }}>
              นับปีแบบปัดเศษ: ปีไหนทำงานตั้งแต่ 183 วันขึ้นไป นับเป็น 1 ปีเต็ม (ค่าใช้จ่ายส่วนแรกคิดที่ 7,000 บาท/ปี — กรณีพิเศษที่ได้รับทั้งบำเหน็จและบำนาญพร้อมกันจะใช้ 3,500 บาท/ปีแทน ซึ่งแอปนี้ยังไม่รองรับกรณีพิเศษนั้น)
            </div>

            {(num(income.lumpSumAmt) > 0 || num(income.lumpSumYears) > 0) && (() => {
              const ls = calcLumpSum(num(income.lumpSumAmt), num(income.lumpSumYears));
              return (
                <div style={{ marginTop: 16, background: "#0F1B33", borderRadius: 7, padding: "16px 16px" }}>
                  <div style={{ fontSize: 14.5, color: "#BFE3F0", fontWeight: 700, marginBottom: 10 }}>ผลการคำนวณ (แยกยื่นต่างหาก ไม่รวมกับเงินได้อื่น)</div>
                  <SummaryLine label="เงินได้ทั้งก้อน" value={ls.amt} />
                  <SummaryLine label="หัก ค่าใช้จ่ายส่วนแรก (7,000 × ปี)" value={ls.exp1} sign="-" />
                  <SummaryLine label="หัก ค่าใช้จ่ายส่วนที่สอง (50% ของส่วนที่เหลือ)" value={ls.exp2} sign="-" />
                  <div style={{ height: 2, background: "#33436A", margin: "8px 0" }} />
                  <SummaryLine label="เงินได้สุทธิ (ฐานภาษี เฉพาะก้อนนี้)" value={ls.netTaxable} bold big />
                  <SummaryLine label="ภาษีที่ต้องชำระ (ยื่นแยกเป็นใบแนบ)" value={ls.tax} bold big />
                </div>
              );
            })()}
          </StaticCard>
          )}

          {selectedGroups.inc_crypto && (
          <StaticCard en="40(4)(ฌ)" th="กำไรจากคริปโทเคอร์เรนซี/สินทรัพย์ดิจิทัล">
            <div className="rule-text" style={{ marginBottom: 14 }}>
              กำไรจากการขาย/โอน/แลกเปลี่ยนคริปโทเคอร์เรนซีหรือโทเคนดิจิทัล เฉพาะส่วนที่เกินกว่าต้นทุน ถือเป็นเงินได้ตามมาตรา 40(4)(ฌ) — <b>หักค่าใช้จ่ายไม่ได้เลย</b> ต้องนำกำไรเต็มจำนวนมารวมคำนวณภาษี แม้จะถูกหักภาษี ณ ที่จ่าย 15% ไปแล้วก็ไม่ใช่ Final Tax ต้องยื่นรวมกับเงินได้อื่นเสมอ (ขาดทุนไม่สามารถนำมาหักลบกับเงินได้ประเภทอื่นได้)
            </div>
            <div className="row2">
              <div>
                <label className="label-sm">มูลค่าที่ขาย/โอนได้ (บาท)</label>
                <NumField value={income.cryptoSaleValue} onChange={(v) => setIncome({ ...income, cryptoSaleValue: v })} placeholder="0" />
              </div>
              <div>
                <label className="label-sm">ต้นทุนที่ซื้อมา (บาท)</label>
                <NumField value={income.cryptoCost} onChange={(v) => setIncome({ ...income, cryptoCost: v })} placeholder="0" />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label className="label-sm">ค่าธรรมเนียมที่เกี่ยวข้อง (ถ้ามี, บาท)</label>
              <NumField value={income.cryptoFee} onChange={(v) => setIncome({ ...income, cryptoFee: v })} placeholder="0" />
            </div>
            <div className="rule-text" style={{ marginTop: 4 }}>
              กรมสรรพากรแนะนำวิธี FIFO (First In, First Out) ในการหาต้นทุน — ถ้าซื้อขายหลายรายการ ให้รวมยอดกำไรสุทธิทั้งปีมากรอกในช่องนี้
            </div>
            <WhtField value={income.cryptoWht} onChange={(v) => setIncome({ ...income, cryptoWht: v })} />
            <div className="rule-text" style={{ marginTop: 2 }}>
              ผู้จ่ายเงินได้ (เช่น ศูนย์ซื้อขายสินทรัพย์ดิจิทัล) มีหน้าที่หักภาษี ณ ที่จ่าย 15% ของกำไร — นำยอดที่ถูกหักไว้มากรอกที่นี่เพื่อใช้เป็นเครดิตหักออกจากภาษีที่คำนวณได้
            </div>

            {(num(income.cryptoSaleValue) > 0 || num(income.cryptoCost) > 0) && (() => {
              const gain = Math.max(0, num(income.cryptoSaleValue) - num(income.cryptoCost) - num(income.cryptoFee));
              return (
                <div style={{ marginTop: 16, background: "#0F1B33", borderRadius: 7, padding: "16px 16px" }}>
                  <div style={{ fontSize: 14.5, color: "#BFE3F0", fontWeight: 700, marginBottom: 10 }}>กำไรสุทธิที่ต้องนำไปรวมคำนวณภาษี</div>
                  <SummaryLine label="มูลค่าที่ขายได้" value={num(income.cryptoSaleValue)} />
                  <SummaryLine label="หัก ต้นทุน" value={num(income.cryptoCost)} sign="-" />
                  <SummaryLine label="หัก ค่าธรรมเนียม" value={num(income.cryptoFee)} sign="-" />
                  <div style={{ height: 2, background: "#33436A", margin: "8px 0" }} />
                  <SummaryLine label="กำไรสุทธิ (เงินได้ 40(4)(ฌ))" value={gain} bold big />
                  {(num(income.cryptoSaleValue) - num(income.cryptoCost) - num(income.cryptoFee)) < 0 && (
                    <div className="rule-text" style={{ marginTop: 6, color: "#BFE3F0" }}>รายการนี้ขาดทุน — ไม่นับเป็นเงินได้ (แต่ก็นำไปหักลบกับกำไรรายการอื่นหรือเงินได้ประเภทอื่นไม่ได้เช่นกัน)</div>
                  )}
                </div>
              );
            })()}
          </StaticCard>
          )}

          {/* ---- ส่วนที่ 2: ค่าลดหย่อน ---- */}
          <SectionTitle n="2" title="ค่าลดหย่อน" sub="ทุกรายการแจ้งเพดานที่ใช้ได้จริงของคุณ (คำนวณจากรายได้) พร้อมช่องแจ้งส่วนเกินสิทธิ์และสิทธิ์ที่ยังเหลือ" />

          {selectedGroups.ded_1 && (
          <StaticCard en="กลุ่ม 1" th="ส่วนตัวและครอบครัว">
            <Row label="ค่าลดหย่อนส่วนตัว" value="60,000 บาท (อัตโนมัติ)" />
            <label className="checkbox-row" style={{ marginTop: 14 }}>
              <input type="checkbox" checked={ded.hasSpouse} onChange={(e) => setDed({ ...ded, hasSpouse: e.target.checked })} />
              คู่สมรสจดทะเบียนสมรส ไม่มีเงินได้ (ลดหย่อนได้ 60,000 บาท)
            </label>

            <div className="row2" style={{ marginTop: 16 }}>
              <div>
                <label className="label-sm">จำนวนบุตร (คน)</label>
                <NumField value={ded.childrenTotal} onChange={(v) => setDed({ ...ded, childrenTotal: v })} placeholder="0" />
              </div>
              <div>
                <label className="label-sm">ในจำนวนนี้ เป็นบุตรคนที่ 2 ขึ้นไปที่เกิดตั้งแต่ปี 2561</label>
                <NumField value={ded.childrenBonus} onChange={(v) => setDed({ ...ded, childrenBonus: v })} placeholder="0" />
              </div>
            </div>
            <div className="rule-text">
              บุตรคนละ 30,000 บาท และคนที่ 2 ขึ้นไปที่เกิดตั้งแต่ 2561 ได้เพิ่มอีก 30,000 บาท (รวมเป็น 60,000/คน) — รวมลดหย่อนบุตร {fmt(calc.dChildren)} บาท
            </div>
            <div className="rule-text" style={{ marginTop: 2 }}>
              เงื่อนไขบุตรที่นำมาลดหย่อนได้: เป็นบุตรชอบด้วยกฎหมายหรือบุตรบุญธรรม อายุไม่เกิน 20 ปี (หรือไม่เกิน 25 ปีถ้ายังเรียนอยู่) และบุตรต้องมีเงินได้ไม่เกิน 30,000 บาท/ปี — บุตรบุญธรรมนับได้ไม่เกิน 3 คน (บุตรชอบด้วยกฎหมายไม่จำกัดจำนวน)
            </div>
            <div className="rule-text" style={{ marginTop: 2 }}>
              <b>บุตรคนแรก (ตามลำดับการเกิด) ไม่มีสิทธิ์รับเพิ่มไม่ว่าจะเกิดปีไหนก็ตาม</b> — มีแต่คนที่ 2 เป็นต้นไปเท่านั้นที่จะได้รับเพิ่มถ้าเกิดตั้งแต่ปี 2561
              เพราะฉะนั้นถ้ามีบุตร {calc.nChildren || 0} คน จำนวนที่กรอกในช่องขวาจะใส่ได้สูงสุดแค่ <b>{calc.maxChildrenBonus}</b> คน
            </div>
            {calc.childrenBonusRaw > calc.maxChildrenBonus && (
              <div className="excess-box">
                คุณกรอกไว้ {calc.childrenBonusRaw} คน แต่มีบุตรทั้งหมดแค่ {calc.nChildren} คน (บุตรคนแรกไม่มีสิทธิ์รับเพิ่มเสมอ) —
                ระบบจึงนับให้จริงแค่ {calc.nChildrenBonus} คน ลองเช็คอีกครั้งว่าลำดับการเกิด/ปีเกิดของบุตรแต่ละคนกรอกถูกต้องไหม
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <label className="label-sm">บิดามารดา อายุ 60 ปีขึ้นไป มีเงินได้ไม่เกิน 30,000 บาท/ปี (คน)</label>
              <NumField value={ded.parents} onChange={(v) => setDed({ ...ded, parents: v })} placeholder="0" />
            </div>
            <div className="rule-text">
              {ded.hasSpouse
                ? "คุณเลือกใช้สิทธิ์คู่สมรส (ไม่มีเงินได้) จึงมีสิทธิ์เลี้ยงดูบิดามารดาได้สูงสุด 4 คน (บิดามารดาของตนเอง 2 คน + บิดามารดาของคู่สมรส 2 คน) คนละ 30,000 บาท"
                : "คุณไม่ได้ใช้สิทธิ์คู่สมรส (ไม่ได้สมรส หรือคู่สมรสมีเงินได้) จึงมีสิทธิ์เลี้ยงดูได้เฉพาะบิดามารดาของตนเอง สูงสุด 2 คน คนละ 30,000 บาท"}
            </div>
            {calc.parentsRaw > calc.maxParents && (
              <div className="excess-box">
                คุณกรอก {calc.parentsRaw} คน แต่สิทธิ์สูงสุดของคุณคือ {calc.maxParents} คน — นำมาลดหย่อนได้จริงเพียง {fmt(calc.dParents)} บาท
                (ส่วนเกิน {calc.parentsRaw - calc.maxParents} คน ไม่สามารถใช้สิทธิ์ได้)
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <label className="label-sm">ผู้พิการ/ทุพพลภาพที่อุปการะ (คน) — คนละ 60,000 บาท</label>
              <NumField value={ded.disabled} onChange={(v) => setDed({ ...ded, disabled: v })} placeholder="0" />
              <div className="rule-text">
                <b>ไม่จำกัดจำนวนคน</b> (ต่างจากบิดามารดาที่จำกัด 4 คน) — แต่คนพิการแต่ละคนต้องเข้าเงื่อนไขครบทุกข้อ:
              </div>
              <ol style={{ margin: "6px 0 0", paddingLeft: 20, fontSize: 14, color: "#14314F", lineHeight: 1.6 }}>
                <li style={{ marginBottom: 6 }}>มีบัตรประจำตัวคนพิการ หรือใบรับรองแพทย์กรณีทุพพลภาพ</li>
                <li style={{ marginBottom: 6 }}>คนพิการมีรายได้ไม่เกิน 30,000 บาท/ปี</li>
                <li style={{ marginBottom: 6 }}>ผู้มีเงินได้ต้องเป็น "ผู้ดูแล" ตามกฎหมาย มีหนังสือรับรองการอุปการะหรือมีชื่อในบัตรเป็นผู้ดูแล และดูแลมาไม่ต่ำกว่า 180 วันในปีภาษี</li>
                <li>คนพิการ 1 คน ให้สิทธิ์ผู้ดูแลใช้ได้เพียง 1 คนเท่านั้น (ถ้ามีผู้ดูแลหลายคนต้องตกลงกันว่าใครใช้สิทธิ์)</li>
              </ol>
              <div className="rule-text" style={{ marginTop: 6 }}>
                <b>ถ้าคนพิการเป็นบิดามารดา/คู่สมรส/บุตรของตัวเอง</b> ใช้สิทธิ์ได้ทั้งสองทางพร้อมกัน — ทั้งค่าลดหย่อนตามความสัมพันธ์ปกติ (เช่น เลี้ยงดูบิดามารดา 30,000, บุตร 30,000/60,000, คู่สมรส 60,000) และค่าลดหย่อนคนพิการ 60,000 นี้ ซ้อนกันได้ ไม่ตัดสิทธิ์กัน
              </div>
            </div>
          </StaticCard>
          )}

          {selectedGroups.ded_2 && (
          <StaticCard en="กลุ่ม 2" th="ประกันภัย">

            {isSubSelected("ded_2", "social") && (
            <>
            <label className="label-sm">เงินสมทบประกันสังคม</label>
            <NumField value={ded.socialSecurity} onChange={(v) => setDed({ ...ded, socialSecurity: v })} placeholder="0" />
            <CapNote rule="ลดหย่อนได้ตามที่จ่ายจริง สูงสุด 9,000 บาท" cap={calc.socialCap} raw={calc.socialRaw} used={calc.dSocial} />
            <div className="rule-text" style={{ marginTop: 2 }}>
              เงินสมทบหักจากเงินเดือนอัตรา 5% ตามฐานค่าจ้างจริง — ปี 2569 เพดานค่าจ้างขยับเป็น 17,500 บาท/เดือน ทำให้บางคนถูกหักสูงสุดถึง 875 บาท/เดือน (10,500 บาท/ปี)
              แต่ <b>สิทธิ์ลดหย่อนภาษียังคงเพดานเดิมที่ 9,000 บาท/ปี</b> (ตามกฎกระทรวงที่ยังไม่ปรับตาม) ส่วนที่จ่ายเกิน 9,000 จึงลดหย่อนภาษีไม่ได้ แม้จะจ่ายจริงมากกว่านั้น
            </div>
            </>
            )}

            {isSubSelected("ded_2", "selfLifeHealth") && (
            <>
            <div style={{ marginTop: 20 }}>
              <label className="label-sm">เบี้ยประกันสุขภาพตนเอง</label>
              <NumField value={ded.healthInsurance} onChange={(v) => setDed({ ...ded, healthInsurance: v })} placeholder="0" />
              <CapNote rule="เพดานย่อยของประกันสุขภาพ ไม่เกิน 25,000 บาท (อยู่ภายใต้เพดานรวมกับประกันชีวิต 100,000 บาท ด้านล่าง)" cap={calc.healthCap} raw={calc.healthRaw} used={calc.healthUsedOwn} />
            </div>

            <div style={{ marginTop: 20 }}>
              <label className="label-sm">เบี้ยประกันชีวิตทั่วไป</label>
              <NumField value={ded.lifeInsurance} onChange={(v) => setDed({ ...ded, lifeInsurance: v })} placeholder="0" />
            </div>
            <CapNote rule="ประกันชีวิต + ประกันสุขภาพตนเอง (หลังหักเพดานย่อยแล้ว) รวมกันไม่เกิน 100,000 บาท" cap={calc.lifeHealthCap} raw={calc.lifeHealthRawSum} used={calc.dLifeHealth} />
            <div className="rule-text" style={{ marginTop: 2 }}>
              กรมธรรม์ต้องมีความคุ้มครองตั้งแต่ 10 ปีขึ้นไป (กรณีประกันชีวิต) และทำกับบริษัทประกันในไทย
            </div>
            </>
            )}

            {isSubSelected("ded_2", "spouseLife") && ded.hasSpouse && (
              <div style={{ marginTop: 20 }}>
                <label className="label-sm">เบี้ยประกันชีวิตของคู่สมรส (ไม่มีเงินได้)</label>
                <NumField value={ded.spouseInsurance} onChange={(v) => setDed({ ...ded, spouseInsurance: v })} placeholder="0" />
                <CapNote rule="ลดหย่อนได้ตามที่จ่ายจริง สูงสุด 10,000 บาท" cap={calc.spouseInsuranceCap} raw={calc.spouseInsuranceRaw} used={calc.dSpouseInsurance} />
                <div className="rule-text" style={{ marginTop: 2 }}>
                  <b>เฉพาะเบี้ยประกันชีวิตเท่านั้น</b> (ไม่รวมเบี้ยประกันสุขภาพของคู่สมรส ซึ่งไม่มีสิทธิ์ลดหย่อนแยกต่างหาก) แยกเพดานต่างหากจากประกันชีวิตของตนเองด้านบน — ใช้สิทธิ์ได้เฉพาะกรณีคู่สมรสจดทะเบียนสมรสถูกต้องและไม่มีเงินได้เท่านั้น (ถ้าคู่สมรสมีเงินได้ ให้คู่สมรสไปหักลดหย่อนเองในการยื่นภาษีของตัวเอง)
                </div>
                <div className="rule-text" style={{ marginTop: 4 }}>
                  <b>เงื่อนไขระยะเวลา: ต้องเป็นคู่สมรสกันตลอดทั้งปีภาษี</b> (1 ม.ค. - 31 ธ.ค. 2569) — ถ้าเพิ่งจดทะเบียนสมรสระหว่างปี หรือคู่สมรสเสียชีวิต/หย่าร้างระหว่างปี จะไม่มีสิทธิ์ใช้ลดหย่อนตัวนี้ (ต่างจากค่าลดหย่อนคู่สมรส 60,000 บาทด้านบน ซึ่งจดทะเบียนภายในปีภาษีก็ใช้สิทธิ์ได้)
                </div>
              </div>
            )}
            {isSubSelected("ded_2", "spouseLife") && !ded.hasSpouse && (
              <div className="rule-text" style={{ marginTop: 20 }}>
                รายการนี้ใช้สิทธิ์ได้เฉพาะผู้ที่มีคู่สมรส — ไปติ๊ก "คู่สมรสจดทะเบียนสมรส ไม่มีเงินได้" ในกลุ่มส่วนตัวและครอบครัวก่อน
              </div>
            )}

            {isSubSelected("ded_2", "parentHealth") && (
            <div style={{ marginTop: 20 }}>
              <label className="label-sm">เบี้ยประกันสุขภาพบิดามารดา</label>
              <NumField value={ded.parentHealthInsurance} onChange={(v) => setDed({ ...ded, parentHealthInsurance: v })} placeholder="0" />
              <CapNote rule="ลดหย่อนได้ตามที่จ่ายจริง สูงสุด 15,000 บาท" cap={calc.parentHealthCap} raw={calc.parentHealthRaw} used={calc.dParentHealth} />
              <div className="rule-text" style={{ marginTop: 2 }}>
                เพดาน 15,000 บาทนี้คือ<b>รวมบิดาและมารดาทั้งสองคนเข้าด้วยกัน</b> (ไม่ใช่คนละ 15,000) — เงื่อนไข: บิดามารดา (ของตนเองหรือของคู่สมรสที่ไม่มีเงินได้) ต้องมีรายได้พึงประเมินไม่เกิน 30,000 บาท/ปี <b>ไม่มีเงื่อนไขเรื่องอายุ</b> (ต่างจากสิทธิ์เลี้ยงดูบิดามารดาด้านบนที่ต้องอายุ 60+) และต้องมีเลขบัตรประชาชนไทย
              </div>
            </div>
            )}
            <div className="rule-text" style={{ marginTop: 12 }}>
              ประกันชีวิตแบบบำนาญย้ายไปรวมอยู่ในกลุ่มเกษียณ (กลุ่ม 3) ด้านล่าง เพื่อให้เห็นเพดานรวม 500,000 บาทในที่เดียว
            </div>
          </StaticCard>
          )}

          {selectedGroups.ded_3 && (
          <StaticCard en="กลุ่ม 3" th="กองทุนเพื่อการเกษียณ — เพดานรวม 500,000 บาท">

            <div style={{ background: "#FBF6E8", border: "2px solid #A9812F", borderRadius: 6, padding: "12px 14px", marginBottom: 18, fontSize: 13.5, color: "#7A5A0F", fontWeight: 700, lineHeight: 1.7 }}>
              🟡 ทั้ง 5 รายการด้านล่างนี้ (ประกันบำนาญ + PVD/กบข. + RMF + SSF + กอช.) ใช้เพดานลดหย่อนรวมกันไม่เกิน 500,000 บาท — รวมไว้ในที่เดียวเพื่อให้วางแผนได้ง่ายขึ้น
            </div>

            {isSubSelected("ded_3", "annuity") && (
            <RetireGroupBox calc={calc}>
              <label className="label-sm">เบี้ยประกันชีวิตแบบบำนาญ</label>
              <NumField value={ded.annuityInsurance} onChange={(v) => setDed({ ...ded, annuityInsurance: v })} placeholder="0" />
              <div className="rule-text">
                กฎหมายกำหนด: หักได้ 15% ของเงินได้ แต่ไม่เกิน 200,000 บาท —
                <b> เพดานที่ใช้ได้จริงของคุณ (15% ของเงินได้ {fmt(calc.income40)} บาท) คือ {fmt(calc.annuityCap)} บาท</b>
              </div>
              <div className="rule-text" style={{ marginTop: 2 }}>
                เงื่อนไข: กรมธรรม์ต้องมีระยะเวลาคุ้มครองตั้งแต่ 10 ปีขึ้นไป และจ่ายผลประโยชน์เป็นเงินบำนาญเมื่อผู้เอาประกันอายุตั้งแต่ 55-85 ปีขึ้นไป
              </div>
              <CapNote rule="" cap={calc.annuityCap} raw={calc.annuityRaw} used={calc.annuityOwnUsed} hideRule />
            </RetireGroupBox>
            )}

            {isSubSelected("ded_3", "pvd") && (
            <div style={{ marginTop: 20 }}>
              <RetireGroupBox calc={calc}>
                <label className="label-sm">กองทุนสำรองเลี้ยงชีพ/กบข.</label>
                <NumField value={ded.pvd} onChange={(v) => setDed({ ...ded, pvd: v })} placeholder="0" />
                <div className="rule-text">
                  กฎหมายกำหนด: หักได้ตามจริง ไม่เกิน 15% ของเงินได้ และไม่เกิน 500,000 บาท —
                  <b> เพดานที่ใช้ได้จริงของคุณคือ {fmt(calc.pvdCap)} บาท</b>
                </div>
                <div className="rule-text" style={{ marginTop: 2 }}>
                  เงื่อนไข: หักผ่านนายจ้าง/หน่วยงานราชการโดยอัตโนมัติทุกเดือน (ไม่ใช่ซื้อเองแบบกองทุน) ตัวเลขนี้คือยอดสะสมที่ถูกหักไปแล้วตลอดปี
                </div>
                <CapNote rule="" cap={calc.pvdCap} raw={calc.pvdRaw} used={calc.pvdOwnUsed} hideRule />
              </RetireGroupBox>
            </div>
            )}

            {isSubSelected("ded_3", "rmf") && (
            <div style={{ marginTop: 20 }}>
              <RetireGroupBox calc={calc}>
                <label className="label-sm">RMF — กองทุนรวมเพื่อการเลี้ยงชีพ</label>
                <NumField value={ded.rmf} onChange={(v) => setDed({ ...ded, rmf: v })} placeholder="0" />
                <div className="rule-text">
                  กฎหมายกำหนด: หักได้ 30% ของเงินได้ ไม่เกิน 500,000 บาท —
                  <b> เพดานที่ใช้ได้จริงของคุณ (30% ของเงินได้ {fmt(calc.income40)} บาท) คือ {fmt(calc.rmfCap)} บาท</b>
                </div>
                <div className="rule-text" style={{ marginTop: 2 }}>
                  เงื่อนไข: ต้องซื้อต่อเนื่องอย่างน้อยปีเว้นปี (ห้ามหยุดซื้อเกิน 1 ปีติดต่อกัน) และถือหน่วยลงทุนจนอายุครบ 55 ปีบริบูรณ์ และลงทุนมาแล้วไม่น้อยกว่า 5 ปี ถ้าขายก่อนครบเงื่อนไขต้องคืนภาษีที่เคยได้รับยกเว้น
                </div>
                <CapNote rule="" cap={calc.rmfCap} raw={calc.rmfRaw} used={calc.rmfOwnUsed} hideRule />
              </RetireGroupBox>
            </div>
            )}

            <div style={{ marginTop: 20 }}>
              <div style={{ background: "#F3F1EC", border: "2px solid #B8AF9A", borderRadius: 6, padding: "14px 16px" }}>
                <label className="label-sm" style={{ color: "#7A7365" }}>SSF — กองทุนรวมเพื่อการออม</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                  <div className="field-input mono" style={{ background: "#E8E5DD", color: "#9A9382", flex: 1, display: "flex", alignItems: "center" }}>0 (หมดสิทธิ์แล้ว)</div>
                </div>
                <div className="rule-text" style={{ marginTop: 8 }}>
                  ⚠️ <b>สิทธิ์ลดหย่อนภาษีจากการซื้อ SSF ใหม่สิ้นสุดไปแล้วตั้งแต่สิ้นปีภาษี 2567</b> — ปีภาษี 2569 นี้ไม่สามารถซื้อเพิ่มเพื่อใช้ลดหย่อนได้อีกเลย ระบบจึงล็อกช่องนี้ไว้ที่ 0 เสมอ
                </div>
                <div className="rule-text" style={{ marginTop: 4 }}>
                  ถ้ามี SSF เก่าที่ซื้อไว้ในปี 2563-2567 ยังต้องถือครบ 10 ปีตามเงื่อนไขเดิม แต่จะไม่ได้สิทธิ์ลดหย่อนเพิ่มจากยอดเดิมนั้นอีกในปีถัดๆ ไป
                </div>
              </div>
            </div>

            {isSubSelected("ded_3", "nsf") && (
            <div style={{ marginTop: 20 }}>
              {calc.nsfIneligible ? (
                <div style={{ background: "#F3F1EC", border: "2px solid #B8AF9A", borderRadius: 6, padding: "14px 16px" }}>
                  <label className="label-sm" style={{ color: "#7A7365" }}>กอช. — กองทุนการออมแห่งชาติ</label>
                  <div className="field-input mono" style={{ background: "#E8E5DD", color: "#9A9382", marginTop: 6 }}>0 (ไม่มีสิทธิ์สมัคร)</div>
                  <div className="rule-text" style={{ marginTop: 8 }}>
                    ⚠️ <b>กอช. รับเฉพาะคนที่ไม่มีสวัสดิการเกษียณอื่นซ้ำซ้อน</b> — เนื่องจากคุณกรอกยอด{num(ded.socialSecurity) > 0 ? "เงินสมทบประกันสังคม" : ""}{num(ded.socialSecurity) > 0 && num(ded.pvd) > 0 ? " และ" : ""}{num(ded.pvd) > 0 ? "กองทุนสำรองเลี้ยงชีพ/กบข." : ""}ไว้แล้ว จึงไม่เข้าเงื่อนไขสมาชิก กอช.
                  </div>
                  <div className="rule-text" style={{ marginTop: 4 }}>
                    ไม่มีสิทธิ์สมัคร กอช. ได้แก่: ผู้ประกันตน ม.33/39, สมาชิก กบข., สมาชิกกองทุนสำรองเลี้ยงชีพ — ระบบจึงล็อกช่องนี้ไว้ที่ 0
                  </div>
                  <div className="rule-text" style={{ marginTop: 4 }}>
                    ถ้าต้องการกรอก กอช. ให้ลบยอดในช่องที่เกี่ยวข้องด้านบนออกก่อน (เข้าเงื่อนไขได้เฉพาะผู้ประกันตน ม.40 ทางเลือก 1 หรือไม่มีสวัสดิการเกษียณใดๆ เลย)
                  </div>
                </div>
              ) : (
                <RetireGroupBox calc={calc}>
                  <label className="label-sm">กอช. — กองทุนการออมแห่งชาติ</label>
                  <NumField value={ded.nsf} onChange={(v) => setDed({ ...ded, nsf: v })} placeholder="0" />
                  <div className="rule-text">
                    เงื่อนไข: เฉพาะผู้ที่ไม่ได้อยู่ในระบบประกันสังคม ม.33/39 (แต่ ม.40 ทางเลือก 1 สมัครได้) ไม่เป็นสมาชิก กบข./กองทุนสำรองเลี้ยงชีพ อายุ 15-60 ปี — ส่วนใหญ่เป็นแรงงานอิสระ/อาชีพอิสระที่ไม่มีสวัสดิการเกษียณอื่น
                  </div>
                  <CapNote rule="ลดหย่อนได้ตามที่จ่ายจริง สูงสุด 30,000 บาท" cap={calc.nsfCap} raw={calc.nsfRaw} used={calc.nsfOwnUsed} />
                </RetireGroupBox>
              )}
            </div>
            )}

            {isSubSelected("ded_3", "teacherFund") && (
            <div style={{ marginTop: 20 }}>
              <RetireGroupBox calc={calc}>
                <label className="label-sm">กองทุนสงเคราะห์ครูโรงเรียนเอกชน</label>
                <NumField value={ded.teacherFund} onChange={(v) => setDed({ ...ded, teacherFund: v })} placeholder="0" />
                <div className="rule-text">
                  เฉพาะครูโรงเรียนเอกชนที่เป็นสมาชิกกองทุน — กฎหมายกำหนด: หักได้ตามจริง ไม่เกิน 15% ของเงินได้ และไม่เกิน 500,000 บาท —
                  <b> เพดานที่ใช้ได้จริงของคุณคือ {fmt(calc.teacherFundCap)} บาท</b>
                </div>
                <CapNote rule="" cap={calc.teacherFundCap} raw={calc.teacherFundRaw} used={calc.teacherFundOwnUsed} hideRule />
              </RetireGroupBox>
            </div>
            )}

            <div style={{ marginTop: 20, background: "#E4F5E6", border: "2px solid #2CA8D8", borderRadius: 6, padding: "16px 18px" }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: "#1B5E3A", marginBottom: 6 }}>เพดานรวมกลุ่มเกษียณ (ประกันบำนาญ + PVD/กบข. + RMF + SSF + กอช. + กองทุนครูเอกชน)</div>
              <div className="rule-text" style={{ marginTop: 0 }}>
                กฎหมายกำหนดเพดานรวมของกลุ่มนี้ไว้ไม่เกิน 500,000 บาท และเพดานสูงสุดที่เป็นไปได้จริงตามรายได้ของคุณคือ <b>{fmt(calc.groupMaxAchievable)} บาท</b>
              </div>
              <div className="rule-text">รวมที่กรอกไว้ก่อนปรับเพดาน: {fmt(calc.groupOwnUsedTotal)} บาท → นำมาลดหย่อนได้จริง: <b>{fmt(calc.retirementGroupTotal)} บาท</b></div>
              {calc.groupOwnUsedTotal > calc.GROUP_CAP && (
                <div className="excess-box">
                  ยอดรวมกลุ่มนี้เกินเพดาน 500,000 บาท ระบบปรับลดสัดส่วนแต่ละรายการให้อัตโนมัติ — ส่วนที่ใช้สิทธิ์ไม่ได้ {fmt(calc.groupOwnUsedTotal - calc.retirementGroupTotal)} บาท
                </div>
              )}
              {calc.groupOwnUsedTotal <= calc.GROUP_CAP && calc.retirementGroupTotal < calc.groupMaxAchievable && (
                <div className="remaining-box">
                  กลุ่มนี้ยังใช้สิทธิ์ไม่เต็ม สามารถซื้อเพิ่มได้อีกรวม {fmt(calc.groupMaxAchievable - calc.retirementGroupTotal)} บาท จนเต็มเพดาน {fmt(calc.groupMaxAchievable)} บาท
                </div>
              )}
            </div>

            {isSubSelected("ded_3", "tesg") && (
            <div style={{ marginTop: 20, background: "#FFFFFF", border: "2px solid #2C6FA8", borderRadius: 6, padding: "16px 18px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#0B3D78", background: "#DCEBF7", borderRadius: 4, padding: "3px 9px", display: "inline-block", marginBottom: 8 }}>
                แยกเพดานต่างหาก ไม่รวมกับกลุ่มเกษียณ 500,000 บาทด้านบน
              </div>
              <label className="label-sm">กองทุนรวมไทยเพื่อความยั่งยืน (Thai ESG)</label>
              <NumField value={ded.tesg} onChange={(v) => setDed({ ...ded, tesg: v })} placeholder="0" />
              <div className="rule-text">
                กฎหมายกำหนด: หักได้ 30% ของเงินได้ ไม่เกิน 300,000 บาท (สำหรับหน่วยลงทุนที่ซื้อถึง 31 ธ.ค. 2569 ถือครองไม่น้อยกว่า 5 ปี) —
                <b> เพดานที่ใช้ได้จริงของคุณคือ {fmt(calc.tesgCap)} บาท</b>
              </div>
              <CapNote rule="" cap={calc.tesgCap} raw={calc.tesgRaw} used={calc.dTesg} hideRule />
            </div>
            )}

            {isSubSelected("ded_3", "thaiesgx") && (
            <div style={{ marginTop: 20, background: "#FFFFFF", border: "2px solid #2C6FA8", borderRadius: 6, padding: "16px 18px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#0B3D78", background: "#DCEBF7", borderRadius: 4, padding: "3px 9px", display: "inline-block", marginBottom: 8 }}>
                แยกเพดานต่างหาก ไม่รวมกับกลุ่มเกษียณและ Thai ESG ด้านบน
              </div>
              <label className="label-sm">Thai ESGX</label>
              <NumField value={ded.thaiesgx} onChange={(v) => setDed({ ...ded, thaiesgx: v })} placeholder="0" />
              <div className="rule-text">
                เฉพาะผู้ที่สับเปลี่ยนหน่วยลงทุน LTF เดิมมาเป็น ThaiESGX ในช่วง พ.ค.-มิ.ย. 2568 เท่านั้น — สำหรับปีภาษี 2569 (ปีที่ 2 ของสิทธิ์ 5 ปี) เพดานคงที่ <b>50,000 บาท/ปี</b>
              </div>
              <CapNote rule="" cap={calc.thaiesgxCap} raw={calc.thaiesgxRaw} used={calc.dThaiesgx} hideRule />
            </div>
            )}
          </StaticCard>
          )}

          {selectedGroups.ded_4 && (
          <StaticCard en="กลุ่ม 4" th="ดอกเบี้ยที่อยู่อาศัย">
            <label className="label-sm">ดอกเบี้ยเงินกู้ยืมเพื่อที่อยู่อาศัย</label>
            <NumField value={ded.homeInterest} onChange={(v) => setDed({ ...ded, homeInterest: v })} placeholder="0" />
            <CapNote rule="ลดหย่อนได้ตามที่จ่ายจริง สูงสุด 100,000 บาท" cap={calc.homeInterestCap} raw={calc.homeInterestRaw} used={calc.dHomeInterest} />
            <div className="rule-text" style={{ marginTop: 2 }}>
              เงื่อนไข: เป็นดอกเบี้ยกู้ซื้อ/สร้างที่อยู่อาศัยที่ตนเองเป็นเจ้าของและใช้เป็นที่อยู่อาศัยจริง กู้จากสถาบันการเงินในไทย — ถ้ากู้ร่วมหลายคน ต้องหารเฉลี่ยเพดาน 100,000 บาทตามจำนวนผู้กู้ร่วม (ไม่ใช่คนละ 100,000)
            </div>
          </StaticCard>
          )}

          {selectedGroups.ded_5 && (
          <StaticCard en="กลุ่ม 5" th="เงินบริจาค">
            <label className="label-sm">เงินบริจาคทั่วไป</label>
            <NumField value={ded.donateGeneral} onChange={(v) => setDed({ ...ded, donateGeneral: v })} placeholder="0" />

            <div style={{ marginTop: 20 }}>
              <label className="label-sm">บริจาคเพื่อการศึกษา/กีฬา/รพ.รัฐ/สาธารณประโยชน์ (ได้ 2 เท่า)</label>
              <NumField value={ded.donateDouble} onChange={(v) => setDed({ ...ded, donateDouble: v })} placeholder="0" />
              <div className="rule-text">
                ⚠ กรอกจำนวนเงินที่บริจาคจริง (ตามใบเสร็จ) เท่านั้น — ไม่ต้องคูณ 2 เอง ระบบจะคำนวณสิทธิ์ลดหย่อนเป็น 2 เท่าให้อัตโนมัติ
                (บริจาคจริง {fmt(num(ded.donateDouble))} บาท → นำไปลดหย่อนได้ {fmt(num(ded.donateDouble) * 2)} บาท ก่อนเช็คเพดาน 10%)
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <label className="label-sm">บริจาคพรรคการเมือง</label>
              <NumField value={ded.donateParty} onChange={(v) => setDed({ ...ded, donateParty: v })} placeholder="0" />
              <CapNote rule="ลดหย่อนได้สูงสุด 10,000 บาท" cap={calc.partyCap} raw={calc.partyRaw} used={calc.dPartyDonate} />
            </div>

            <div className="rule-text" style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #CFE8F0" }}>
              คำนวณ 2 ขั้นต่อเนื่องกัน: <b>ขั้น 1</b> หักบริจาค 2 เท่าก่อน ไม่เกิน 10% ของเงินได้หลังหักค่าใช้จ่ายและลดหย่อนอื่น (เพดาน {fmt(calc.doubleCap)} บาท)
              <b> ขั้น 2</b> เอาเงินที่เหลือ ({fmt(calc.afterDoubleDonation)} บาท) มาคิดเพดาน 10% ใหม่ ({fmt(calc.generalCap)} บาท) แล้วค่อยหักบริจาคทั่วไป
            </div>
            {calc.donateDoubleRaw > calc.doubleCap && (
              <div className="excess-box">บริจาค 2 เท่าเกินเพดาน — บริจาคจริง {fmt(num(ded.donateDouble))} บาท (คิดเป็น {fmt(calc.donateDoubleRaw)} บาท) ใช้สิทธิ์ได้จริงแค่ {fmt(calc.dDonateDouble)} บาท ส่วนเกิน {fmt(calc.donateDoubleRaw - calc.dDonateDouble)} บาท ใช้สิทธิ์ไม่ได้</div>
            )}
            {calc.donateGeneralRaw > calc.generalCap && (
              <div className="excess-box">บริจาคทั่วไปเกินเพดาน — บริจาคจริง {fmt(calc.donateGeneralRaw)} บาท ใช้สิทธิ์ได้จริงแค่ {fmt(calc.dDonateGeneral)} บาท ส่วนเกิน {fmt(calc.donateGeneralRaw - calc.dDonateGeneral)} บาท ใช้สิทธิ์ไม่ได้</div>
            )}
            {calc.donationRawTotal > 0 && calc.donateDoubleRaw <= calc.doubleCap && calc.donateGeneralRaw <= calc.generalCap && (
              <div className="remaining-box">ยังใช้สิทธิ์ไม่เต็ม — บริจาค 2 เท่าเพิ่มได้อีก {fmt(calc.doubleCap - calc.dDonateDouble)} บาท (คิดเป็นเงินบริจาคจริง {fmt((calc.doubleCap - calc.dDonateDouble) / 2)} บาท) และบริจาคทั่วไปเพิ่มได้อีก {fmt(calc.generalCap - calc.dDonateGeneral)} บาท</div>
            )}
          </StaticCard>
          )}

          {selectedGroups.ded_6 && (
          <StaticCard en="กลุ่ม 6" th="อื่นๆ และมาตรการกระตุ้นเศรษฐกิจ">
            <label className="label-sm">ค่าฝากครรภ์และคลอดบุตร (ต่อครรภ์)</label>
            <NumField value={ded.maternity} onChange={(v) => setDed({ ...ded, maternity: v })} placeholder="0" />
            <CapNote rule="ลดหย่อนได้ตามที่จ่ายจริง สูงสุด 60,000 บาท" cap={calc.maternityCap} raw={calc.maternityRaw} used={calc.dMaternity} />
            <div className="rule-text" style={{ marginTop: 2 }}>
              เงื่อนไข: เป็นค่าใช้จ่ายฝากครรภ์+คลอดบุตรของตนเองหรือคู่สมรส (สามีใช้สิทธิ์แทนได้ถ้าภรรยาไม่มีเงินได้) นับสิทธิ์แยกเป็นรายครรภ์ ถ้าคลอดหลายครั้งในปีเดียวกันใช้สิทธิ์ได้ทุกครรภ์ แต่ครรภ์เดียวกันใช้ได้ครั้งเดียวแม้คร่อมปีภาษี
            </div>
            <div style={{ marginTop: 20 }}>
              <label className="label-sm">ค่าซื้อสินค้า/บริการตามมาตรการกระตุ้นเศรษฐกิจ (เช่น Easy E-Receipt)</label>
              <NumField value={ded.easyReceipt} onChange={(v) => setDed({ ...ded, easyReceipt: v })} placeholder="0" />
              <CapNote rule="สมมติฐานวงเงินสูงสุด 50,000 บาท" cap={calc.easyReceiptCap} raw={calc.easyReceiptRaw} used={calc.dEasyReceipt} />
            </div>
            <div style={{ marginTop: 14, fontSize: 16, fontWeight: 700, color: "#8A241C", background: "#F9E9E7", border: "2px solid #8A241C", borderRadius: 5, padding: "12px 14px", lineHeight: 1.7 }}>
              ⚠ <b>สถานะล่าสุดที่ตรวจสอบ (ก.ย. 2569):</b> มาตรการ Easy E-Receipt รอบใหม่สำหรับปีภาษี 2569 <b>ยังไม่มีการประกาศอย่างเป็นทางการ</b> — มีรายงานว่าอาจล่าช้าหรือไม่เกิดขึ้นเลย เนื่องจากช่วงที่ผ่านมามีสถานการณ์ ครม. รักษาการซึ่งไม่มีอำนาจเต็มในการอนุมัติมาตรการที่กระทบงบประมาณ/รายได้รัฐ ต้องรอ ครม. ชุดใหม่หลังการเลือกตั้ง — <b>อย่าเพิ่งอ้างอิงวงเงิน 50,000 บาทนี้กับลูกค้าจนกว่าจะมีประกาศทางการยืนยัน</b> ควรตรวจสอบข่าวล่าสุดจากกรมสรรพากรหรือกระทรวงการคลังอีกครั้งก่อนใกล้ช่วงยื่นภาษีจริง
            </div>
          </StaticCard>
          )}

          {/* ================= สรุปผลการคำนวณ (แสดงก่อนเข้าสู่การวางแผนซื้อเพิ่ม) ================= */}
          <div style={{ margin: "36px 0" }}>
            <div style={{ fontSize: 16, color: "#14314F", fontWeight: 700, marginBottom: 12, lineHeight: 1.7 }}>
              จากข้อมูลรายได้และค่าลดหย่อนที่กรอกไว้ (ส่วนที่ 1-2) ตอนนี้ต้องเสียภาษีเท่านี้ — ก่อนจะไปดูในส่วนที่ 3-4 ว่าถ้าไม่อยากเสียภาษีเท่านี้ ควรซื้อค่าลดหย่อนเพิ่มอะไรบ้าง
            </div>

            <div style={{ background: "#0B3D78", borderRadius: 10, padding: "26px 24px 22px", color: "#FBFAF3", position: "relative", overflow: "hidden" }}>
              <div className="mono" style={{ fontSize: 14, letterSpacing: 1.5, color: "#BFE3F0", fontWeight: 700 }}>สรุปผลการคำนวณ</div>
              <div className="serif" style={{ fontSize: 19, marginTop: 4, marginBottom: 4, color: "#BFE3F0" }}>
                {taxpayerName ? `ใบคำนวณภาษีของ ${taxpayerName}` : "ใบคำนวณภาษีโดยประมาณ"}
              </div>
              <div style={{ fontSize: 12.5, color: "#8FA0C4", marginBottom: 20, fontWeight: 600 }}>
                คำนวณจากค่าลดหย่อนที่กรอกไว้จริงในขณะนี้ {selectedItems.length > 0 ? "— ยังไม่รวมรายการที่วางแผนจะซื้อเพิ่มในส่วนที่ 4" : "(ยังไม่ได้ซื้อค่าลดหย่อนเพิ่ม)"}
              </div>

              {num(income.interestAmt) > 0 && (
                <div style={{ background: "#0F1B33", borderRadius: 7, padding: "16px 16px", marginBottom: 20 }}>
                  <div style={{ fontSize: 14.5, color: "#BFE3F0", fontWeight: 700, marginBottom: 10 }}>ดอกเบี้ย: แตะเพื่อเลือกวิธีคำนวณ</div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button
                      onClick={() => setIncome({ ...income, excludeInterest: true })}
                      style={{
                        cursor: "pointer", textAlign: "left", fontFamily: "'Noto Sans Thai', sans-serif",
                        border: `2.5px solid ${income.excludeInterest ? "#A9E0A0" : "#33436A"}`, borderRadius: 6, padding: "12px 12px",
                        background: income.excludeInterest ? "#154C82" : "transparent",
                      }}
                    >
                      <div style={{ fontSize: 12.5, color: "#BFE3F0", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                        {income.excludeInterest && <span style={{ color: "#A9E0A0" }}>●</span>} ไม่รวมคำนวณ
                        {!intIncludeIsBetter && <span style={{ fontSize: 10.5, background: "#A9E0A0", color: "#0B3D78", borderRadius: 3, padding: "1px 6px", fontWeight: 800 }}>คุ้มกว่า</span>}
                      </div>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: "#FBFAF3", marginTop: 4 }}>{fmt(trueTax(calcIntExclude))}</div>
                      <div style={{ fontSize: 11, color: "#BFE3F0" }}>บาท (ดอกเบี้ยหัก 15% แบบ Final Tax)</div>
                    </button>

                    <button
                      onClick={() => setIncome({ ...income, excludeInterest: false })}
                      style={{
                        cursor: "pointer", textAlign: "left", fontFamily: "'Noto Sans Thai', sans-serif",
                        border: `2.5px solid ${!income.excludeInterest ? "#A9E0A0" : "#33436A"}`, borderRadius: 6, padding: "12px 12px",
                        background: !income.excludeInterest ? "#154C82" : "transparent",
                      }}
                    >
                      <div style={{ fontSize: 12.5, color: "#BFE3F0", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                        {!income.excludeInterest && <span style={{ color: "#A9E0A0" }}>●</span>} รวมคำนวณ
                        {intIncludeIsBetter && <span style={{ fontSize: 10.5, background: "#A9E0A0", color: "#0B3D78", borderRadius: 3, padding: "1px 6px", fontWeight: 800 }}>คุ้มกว่า</span>}
                      </div>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: "#FBFAF3", marginTop: 4 }}>
                        {trueTax(calcIntInclude) < 0 ? "คืน " : ""}{fmt(Math.abs(trueTax(calcIntInclude)))}
                      </div>
                      <div style={{ fontSize: 11, color: "#BFE3F0" }}>บาท (สุทธิหลังหักเครดิต)</div>
                    </button>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13, color: "#A9E0A0", fontWeight: 700 }}>
                    {intIncludeIsBetter
                      ? `รวมคำนวณคุ้มกว่า ${fmt(intExcludeTrueTax - intIncludeTrueTax)} บาท`
                      : `ไม่รวมคำนวณคุ้มกว่า ${fmt(intIncludeTrueTax - intExcludeTrueTax)} บาท`}
                  </div>
                </div>
              )}

              {calc.sDividend > 0 && (
                <div style={{ background: "#0F1B33", borderRadius: 7, padding: "16px 16px", marginBottom: 20 }}>
                  <div style={{ fontSize: 14.5, color: "#BFE3F0", fontWeight: 700, marginBottom: 10 }}>เงินปันผล: แตะเพื่อเลือกวิธีคำนวณ</div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button
                      onClick={() => setIncome({ ...income, dividendMode: "exclude" })}
                      style={{
                        cursor: "pointer", textAlign: "left", fontFamily: "'Noto Sans Thai', sans-serif",
                        border: `2.5px solid ${income.dividendMode === "exclude" ? "#A9E0A0" : "#33436A"}`, borderRadius: 6, padding: "12px 12px",
                        background: income.dividendMode === "exclude" ? "#154C82" : "transparent",
                      }}
                    >
                      <div style={{ fontSize: 12.5, color: "#BFE3F0", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                        {income.dividendMode === "exclude" && <span style={{ color: "#A9E0A0" }}>●</span>} ไม่ใช้เครดิต
                        {!divCreditIsBetter && <span style={{ fontSize: 10.5, background: "#A9E0A0", color: "#0B3D78", borderRadius: 3, padding: "1px 6px", fontWeight: 800 }}>คุ้มกว่า</span>}
                      </div>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: "#FBFAF3", marginTop: 4 }}>{fmt(trueTax(calcDivExclude))}</div>
                      <div style={{ fontSize: 11, color: "#BFE3F0" }}>บาท (ปันผลหัก 10% แบบ Final Tax)</div>
                    </button>

                    <button
                      onClick={() => setIncome({ ...income, dividendMode: "credit" })}
                      style={{
                        cursor: "pointer", textAlign: "left", fontFamily: "'Noto Sans Thai', sans-serif",
                        border: `2.5px solid ${income.dividendMode === "credit" ? "#A9E0A0" : "#33436A"}`, borderRadius: 6, padding: "12px 12px",
                        background: income.dividendMode === "credit" ? "#154C82" : "transparent",
                      }}
                    >
                      <div style={{ fontSize: 12.5, color: "#BFE3F0", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                        {income.dividendMode === "credit" && <span style={{ color: "#A9E0A0" }}>●</span>} ใช้เครดิตภาษี
                        {divCreditIsBetter && <span style={{ fontSize: 10.5, background: "#A9E0A0", color: "#0B3D78", borderRadius: 3, padding: "1px 6px", fontWeight: 800 }}>คุ้มกว่า</span>}
                      </div>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: "#FBFAF3", marginTop: 4 }}>
                        {trueTax(calcDivCredit) < 0 ? "คืน " : ""}{fmt(Math.abs(trueTax(calcDivCredit)))}
                      </div>
                      <div style={{ fontSize: 11, color: "#BFE3F0" }}>บาท (สุทธิหลังหักเครดิต)</div>
                    </button>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13, color: "#A9E0A0", fontWeight: 700 }}>
                    {divCreditIsBetter
                      ? `ใช้เครดิตภาษีคุ้มกว่า ${fmt(divExcludeTrueTax - divCreditTrueTax)} บาท`
                      : `ไม่ใช้เครดิตคุ้มกว่า ${fmt(divCreditTrueTax - divExcludeTrueTax)} บาท`}
                  </div>
                </div>
              )}

              <SummaryLine label="เงินได้พึงประเมิน (รวม)" value={calc.totalGrossIncome} />
              <SummaryLine label="หักค่าใช้จ่าย" value={calc.totalGrossIncome - calc.incomeAfterExpense} sign="-" />
              <SummaryLine label="เงินได้หลังหักค่าใช้จ่าย" value={calc.incomeAfterExpense} bold />
              <SummaryLine label="หักค่าลดหย่อน" value={calc.totalDeductions} sign="-" />
              <div style={{ height: 2, background: "#154C82", margin: "14px 0" }} />
              <SummaryLine label="เงินได้สุทธิ (ฐานภาษี)" value={calc.netIncomeTaxable} bold big />

              <div style={{ marginTop: 20, background: "#093163", borderRadius: 7, padding: "18px 18px" }}>
                <div style={{ fontSize: 15, color: "#BFE3F0", marginBottom: 6, fontWeight: 600 }}>ภาษีที่คำนวณได้ (อัตราก้าวหน้า)</div>
                <div className="mono" style={{ fontSize: 30, fontWeight: 800 }}>{fmt(calc.taxProgressive)} <span style={{ fontSize: 16, fontWeight: 500, color: "#DCEFFA" }}>บาท</span></div>
                {calc.usedMinRule && (
                  <div style={{ marginTop: 10, fontSize: 14.5, color: "#A9E0A0", lineHeight: 1.7, fontWeight: 600 }}>
                    ตรวจสอบเกณฑ์ขั้นต่ำ ม.48(2): เงินได้ประเภท (2)-(8) รวม {fmt(calc.nonSalaryIncome240to8)} บาท (≥120,000) ×0.5% = {fmt(calc.taxMin)} บาท ซึ่งสูงกว่า → ใช้ยอดนี้แทน
                  </div>
                )}
              </div>

              <div style={{ marginTop: 18, textAlign: "center" }}>
                <div style={{
                  display: "inline-block", border: "3px solid #C24A40", color: "#E88A82", borderRadius: "50%",
                  width: 108, height: 108, transform: "rotate(-9deg)", padding: "20px 6px 0",
                  fontFamily: "'Noto Serif Thai', serif", fontWeight: 800, fontSize: 15, lineHeight: 1.35,
                }}>
                  ประมาณ<br />การ<br /><span style={{ fontSize: 11 }}>ปีภาษี 2569</span>
                </div>
              </div>

              <div style={{ marginTop: 18, borderTop: "2px solid #154C82", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 16, color: "#DCEFFA", fontWeight: 600 }}>{calc.hasAnyCredit ? "ภาษีที่คำนวณได้ (ก่อนหักเครดิต)" : "ภาษีจากการยื่นแบบ"}</span>
                <span className="mono" style={{ fontSize: 32, fontWeight: 800, color: calc.hasAnyCredit ? "#DCEFFA" : (calc.finalTax > 0 ? "#F0A8A0" : "#A9E0A0") }}>{fmt(calc.finalTax)}</span>
              </div>
              {calc.hasAnyCredit && (
                <>
                  <div style={{ marginTop: 10, background: "#0F1B33", borderRadius: 6, padding: "10px 12px" }}>
                    <div style={{ fontSize: 12.5, color: "#8FA0C4", fontWeight: 700, marginBottom: 6 }}>รายละเอียดเครดิตภาษีที่หักออก:</div>
                    {calc.dividendCreditAmount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                        <span style={{ fontSize: 13.5, color: "#DCEFFA" }}>เครดิตภาษีเงินปันผล (ม.47 ทวิ)</span>
                        <span className="mono" style={{ fontSize: 14, color: "#DCEFFA" }}>− {fmt(calc.dividendCreditAmount)}</span>
                      </div>
                    )}
                    {calc.dividendWht > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                        <span style={{ fontSize: 13.5, color: "#DCEFFA" }}>ภาษีเงินปันผลหัก ณ ที่จ่าย (10%)</span>
                        <span className="mono" style={{ fontSize: 14, color: "#DCEFFA" }}>− {fmt(calc.dividendWht)}</span>
                      </div>
                    )}
                    {calc.interestWhtCredit > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                        <span style={{ fontSize: 13.5, color: "#DCEFFA" }}>ภาษีดอกเบี้ยหัก ณ ที่จ่าย (15%) ที่ขอเครดิตคืน</span>
                        <span className="mono" style={{ fontSize: 14, color: "#DCEFFA" }}>− {fmt(calc.interestWhtCredit)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1px solid #33436A" }}>
                      <span style={{ fontSize: 14, color: "#FBFAF3", fontWeight: 700 }}>รวมเครดิตทั้งหมด</span>
                      <span className="mono" style={{ fontSize: 15, color: "#FBFAF3", fontWeight: 800 }}>− {fmt(calc.allCreditsTotal)}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, borderTop: "1px solid #154C82", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 16, color: "#DCEFFA", fontWeight: 700 }}>{calc.isDividendRefund ? "ได้รับเงินคืนภาษี" : "ภาษีจากการยื่นแบบ ต้องชำระเพิ่ม"}</span>
                    <span className="mono" style={{ fontSize: 26, fontWeight: 800, color: calc.isDividendRefund ? "#A9E0A0" : "#F0A8A0" }}>{fmt(Math.abs(calc.netTaxAfterDividendCredit))}</span>
                  </div>
                </>
              )}

              {calc.withholdingPaid > 0 && (
                <div style={{ marginTop: 14, background: "#0F1B33", borderRadius: 6, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13.5, color: "#BFE3F0" }}>หัก ภาษีที่ถูกหักไว้แล้วระหว่างปี (WHT)</span>
                    <span className="mono" style={{ fontSize: 14, color: "#BFE3F0", fontWeight: 700 }}>− {fmt(calc.withholdingPaid)}</span>
                  </div>
                  <div style={{ marginTop: 10, borderTop: "1px solid #33436A", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 15.5, color: "#FBFAF3", fontWeight: 800 }}>{calc.isOverallRefund ? "ได้รับเงินคืนภาษี" : "ต้องชำระภาษีเพิ่ม"}</span>
                    <span className="mono" style={{ fontSize: 24, fontWeight: 800, color: calc.isOverallRefund ? "#A9E0A0" : "#F0A8A0" }}>{fmt(Math.abs(calc.netPayableAfterWithholding))}</span>
                  </div>
                </div>
              )}

              {calc.totalFinalTaxWithheld > 0 && (
                <div style={{ marginTop: 14, background: "#0F1B33", borderRadius: 6, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13.5, color: "#BFE3F0" }}>+ ภาษี Final Tax ที่ถูกหักไปแล้ว (ดอกเบี้ย/ปันผลที่เลือกไม่รวมคำนวณ)</span>
                    <span className="mono" style={{ fontSize: 14, color: "#BFE3F0", fontWeight: 700 }}>{fmt(calc.totalFinalTaxWithheld)}</span>
                  </div>
                  <div style={{ marginTop: 10, borderTop: "1px solid #33436A", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 13, color: "#8FA0C4", fontWeight: 500 }}>ภาระภาษีที่แท้จริงทั้งหมด</span>
                    <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: "#8FA0C4" }}>{fmt(Math.abs(calc.totalRealTaxBurden))}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#6C7A9C", marginTop: 4 }}>รวมภาษีที่ยื่นชำระ/ขอคืน (หลังหัก WHT) + ภาษี Final Tax ที่หักไว้แล้วต่างหาก — เพื่อทราบไว้เฉยๆ ไม่ใช่ยอดที่ต้องยื่นชำระเพิ่ม</div>
                </div>
              )}
              <div style={{ fontSize: 14, color: "#BFE3F0", textAlign: "right", fontWeight: 600 }}>อัตราภาษีเฉลี่ย {effectiveRate.toFixed(1)}%</div>
            </div>

            <div className="sec-card" style={{ marginTop: 18 }}>
              <FieldTitle en="" th="อัตราภาษีก้าวหน้าแบบขั้นบันได" />
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15.5 }}>
                <thead>
                  <tr style={{ color: "#14314F", textAlign: "left" }}>
                    <th style={{ fontWeight: 700, paddingBottom: 8 }}>ช่วงเงินได้สุทธิ</th>
                    <th style={{ fontWeight: 700, paddingBottom: 8, textAlign: "right" }}>จำนวนเงินในขั้นนี้</th>
                    <th style={{ fontWeight: 700, paddingBottom: 8, textAlign: "right" }}>อัตรา</th>
                    <th style={{ fontWeight: 700, paddingBottom: 8, textAlign: "right" }}>ภาษี</th>
                    <th style={{ fontWeight: 700, paddingBottom: 8, textAlign: "right" }}>ภาษีสะสม</th>
                  </tr>
                </thead>
                <tbody className="mono">
                  {calc.rows.reduce((acc, r) => { acc.cum += r.t; acc.out.push({ ...r, cum: acc.cum }); return acc; }, { cum: 0, out: [] }).out.map((r, i) => (
                    <tr key={i} style={{ color: r.t > 0 ? "#0D1826" : "#6C93A8", borderTop: "1px solid #D7EEF4" }}>
                      <td style={{ padding: "7px 0", fontFamily: "'IBM Plex Mono', monospace" }}>{r.to === Infinity ? `> ${fmt(r.from)}` : `${fmt(r.from)}–${fmt(r.to)}`}</td>
                      <td style={{ textAlign: "right", fontWeight: r.t > 0 ? 700 : 500 }}>{r.taxable > 0 ? fmt(r.taxable) : "—"}</td>
                      <td style={{ textAlign: "right" }}>{r.rate}%</td>
                      <td style={{ textAlign: "right", fontWeight: r.t > 0 ? 800 : 500 }}>{fmt(r.t)}</td>
                      <td style={{ textAlign: "right", fontWeight: r.t > 0 ? 800 : 500, color: r.t > 0 ? "#0B3D78" : "#6C93A8" }}>{fmt(r.cum)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="rule-text" style={{ marginTop: 8 }}>
                "ภาษีสะสม" = ผลรวมภาษีตั้งแต่ขั้นแรกจนถึงขั้นนั้น — ใช้ดูได้ทันทีว่าถ้าลดเงินได้สุทธิให้ไม่เกินขั้นไหน จะเหลือภาษีเท่าไหร่ โดยไม่ต้องบวกเลขเอง
              </div>
              <div className="mono" style={{ fontSize: 17, fontWeight: 800, color: "#0B3D78", marginTop: 14, paddingTop: 12, borderTop: "2px solid #2C6FA8", textAlign: "right" }}>
                รวมภาษี = {fmt(calc.taxProgressive)} บาท
              </div>
            </div>

            <div className="sec-card" style={{ marginTop: 18 }}>
              <button
                onClick={() => setShowDetail((s) => !s)}
                style={{
                  width: "100%", background: "#DCEBF7", border: "2px solid #17406B", borderRadius: 6,
                  padding: "14px 16px", fontSize: 18, fontWeight: 800, color: "#17406B", cursor: "pointer",
                  fontFamily: "'Noto Sans Thai', sans-serif", display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <span>ดูใบสรุปการคำนวณฉบับเต็ม (รายได้ + ค่าใช้จ่าย + ค่าลดหย่อน + ภาษี) — ใช้ประกอบการพิจารณา/ประมาณการ</span>
                <span>{showDetail ? "▲" : "▼"}</span>
              </button>

              <button
                onClick={() => {
                  setPrintMode("summary");
                  setShowDetail(true);
                  window.print();
                }}
                style={{
                  width: "100%", background: "#1B5E3A", border: "2px solid #1B5E3A", borderRadius: 6,
                  padding: "14px 16px", fontSize: 17, fontWeight: 800, color: "#FFFFFF", cursor: "pointer",
                  fontFamily: "'Noto Sans Thai', sans-serif", marginTop: 10,
                  display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                }}
              >
                <span>🖨️ พิมพ์ / บันทึกเป็น PDF ส่งให้ลูกค้า (ใบสรุปการคำนวณ)</span>
              </button>
              <div className="rule-text" style={{ marginTop: 6 }}>
                หมายเหตุ: เบราว์เซอร์บางตัวจะแปะลิงก์เว็บ/วันที่ไว้บน-ล่างของหน้าที่พิมพ์เองอัตโนมัติ ถ้าไม่ต้องการให้มี ในหน้าต่างพิมพ์ให้มองหาตัวเลือก "Headers and Footers" แล้วปิดไว้ก่อนกด Save/Print
              </div>

              <div id="print-area" style={{ display: showDetail ? "block" : "none", marginTop: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, paddingBottom: 12, borderBottom: "2px solid #0B3D78", marginBottom: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#0B3D78" }}>{taxpayerName ? `ใบสรุปการคำนวณภาษีของ ${taxpayerName}` : "ใบสรุปการคำนวณภาษี"}</div>
                    <div style={{ fontSize: 14, color: "#14314F", fontWeight: 600 }}>ปีภาษี 2569 (ยื่นปี 2570)</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#6C93A8", fontWeight: 600, marginBottom: 4 }}>
                    สรุปจากค่าลดหย่อนที่กรอกไว้จริงในขณะนี้ {selectedItems.length > 0 ? "— ยังไม่รวมรายการที่วางแผนจะซื้อเพิ่มในส่วนที่ 4" : "(ยังไม่ได้ซื้อค่าลดหย่อนเพิ่ม)"}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#6C93A8", fontWeight: 600, marginBottom: 16 }}>
                    จัดทำโดยป้าเป็ด CFP — เพื่อใช้ภายในทีมงานสำหรับความสะดวกในการวางแผนภาษีเบื้องต้น ไม่ใช่แบบยื่นภาษีอย่างเป็นทางการ
                  </div>

                  <FullTaxForm calc={calc} income={income} />
                </div>
            </div>
          </div>

          {selectedGroups.inc_director && (
            <div className="sec-card">
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                <span className="mono" style={{ fontSize: 14, color: "#0B3D78", fontWeight: 800 }}>40(1)</span>
                <span style={{ fontWeight: 800, fontSize: 19, color: "#0B3D78" }}>สวัสดิการกรรมการ — เบี้ยประกันที่บริษัทจ่ายแทน</span>
              </div>
              <div className="rule-text" style={{ marginBottom: 14 }}>
                กรอกหลังจากคำนวณภาษีปกติด้านบนเสร็จแล้ว เพื่อดูว่า<b>ถ้าไม่มีสวัสดิการนี้เลยจะเสียภาษีเท่าไหร่ เทียบกับถ้ามีสวัสดิการเพิ่มเข้ามาจะเสียภาษีเท่าไหร่</b> — ในรายละเอียดการคำนวณจะถูกนำไปรวมไว้ในเงินได้ 40(1) เดียวกับเงินเดือนด้านบน
              </div>

              <label className="label-sm">เบี้ยประกันชีวิต/สุขภาพที่บริษัทจ่ายให้ (ในฐานะกรรมการ) ต่อปี</label>
              <NumField value={income.directorBenefitAmt} onChange={(v) => setIncome({ ...income, directorBenefitAmt: v })} placeholder="0" />

              <div style={{ marginTop: 14 }}>
                <label className="label-sm">ผู้รับผลประโยชน์ตามกรมธรรม์คือใคร</label>
                <select className="select-input" value={income.directorBenefitToCompany ? "company" : "family"} onChange={(e) => setIncome({ ...income, directorBenefitToCompany: e.target.value === "company" })}>
                  <option value="company">บริษัทเอง</option>
                  <option value="family">ครอบครัว/ทายาทของกรรมการ</option>
                </select>
              </div>

              {income.directorBenefitToCompany ? (
                <div className="rule-text" style={{ marginTop: 8 }}>
                  ผู้รับผลประโยชน์เป็นบริษัทเอง — เบี้ยประกันนี้<b>ไม่ถือเป็นเงินได้ของกรรมการ</b> ไม่ต้องนำมารวมคำนวณภาษี (ตามแนววินิจฉัยกรมสรรพากร เลขที่ 0706/4227)
                </div>
              ) : (
                <>
                  <div className="rule-text" style={{ marginTop: 8 }}>
                    ผู้รับผลประโยชน์เป็นครอบครัว/ทายาท — เบี้ยประกันนี้ถือเป็น<b>เงินได้พึงประเมินตามมาตรา 40(1)</b> ของกรรมการ ต้องนำมารวมคำนวณภาษีเงินได้บุคคลธรรมดา
                  </div>
                  <label className="checkbox-row" style={{ marginTop: 10 }}>
                    <input type="checkbox" checked={income.directorGrossUp} onChange={(e) => setIncome({ ...income, directorGrossUp: e.target.checked })} />
                    บริษัทจะ "ออกภาษีให้" (Gross-up) เพื่อไม่ให้กรรมการต้องเสียภาษีเพิ่มเองจากสวัสดิการนี้
                  </label>

                  {num(income.directorBenefitAmt) > 0 && (
                    <>
                      <div style={{ marginTop: 16, background: "#0F1B33", borderRadius: 7, padding: "16px 16px" }}>
                        <div style={{ fontSize: 14.5, color: "#BFE3F0", fontWeight: 700, marginBottom: 10 }}>ก่อน-หลังมีสวัสดิการนี้ (คำนวณจากรายได้และค่าลดหย่อนทั้งหมดที่กรอกไว้ครบแล้ว)</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div style={{ border: "2.5px solid #33436A", borderRadius: 6, padding: "12px 12px" }}>
                            <div style={{ fontSize: 12.5, color: "#BFE3F0", fontWeight: 700 }}>ไม่มีสวัสดิการนี้เลย</div>
                            <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: "#FBFAF3", marginTop: 4 }}>{fmt(calc.directorTaxBefore)}</div>
                            <div style={{ fontSize: 11, color: "#BFE3F0" }}>บาท (ภาษีจากการยื่นแบบ)</div>
                          </div>
                          <div style={{ border: "2.5px solid #F0A8A0", borderRadius: 6, padding: "12px 12px" }}>
                            <div style={{ fontSize: 12.5, color: "#BFE3F0", fontWeight: 700 }}>มีสวัสดิการเพิ่ม {fmt(num(income.directorBenefitAmt))} บาท</div>
                            <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: "#FBFAF3", marginTop: 4 }}>
                              {fmt(income.directorGrossUp ? calc.directorTaxAfterWithGrossUp : calc.directorTaxAfterNoGrossUp)}
                            </div>
                            <div style={{ fontSize: 11, color: "#BFE3F0" }}>บาท (ภาษีจากการยื่นแบบ)</div>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 10, background: "#F3F1EC", borderRadius: 6, padding: "12px 14px" }}>
                        {!income.directorGrossUp ? (
                          <div style={{ fontSize: 14.5, color: "#14314F", lineHeight: 1.7 }}>
                            กรรมการต้องเสียภาษีเพิ่มเองจากสวัสดิการนี้ประมาณ <b className="mono">{fmt(calc.directorExtraTaxIfNoGrossUp)}</b> บาท
                          </div>
                        ) : (
                          <div style={{ fontSize: 14.5, color: "#14314F", lineHeight: 1.7 }}>
                            บริษัทต้องออกเงินภาษีให้อีก <b className="mono">{fmt(calc.directorGrossUpAmount)}</b> บาท (Gross-up)
                            <div className="rule-text" style={{ marginTop: 4 }}>
                              เพราะเงินภาษีที่บริษัทออกให้ ก็ถือเป็นเงินได้เพิ่มอีกต่อหนึ่งตามกฎหมาย ต้องคำนวณย้อนกลับด้วยสูตร Gross-up — กรรมการจะไม่ต้องจ่ายภาษีส่วนนี้เองเลย (บริษัทออกให้ทั้งหมด {fmt(calc.directorBenefitTaxable + calc.directorGrossUpAmount)} บาท รวมเบี้ยประกัน+ภาษีที่ออกให้)
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="rule-text" style={{ marginTop: 10 }}>
                        เบี้ยประกันสวัสดิการนี้ถือเป็นเบี้ยประกันชีวิต/สุขภาพของกรรมการเองด้วย จึงดึงมาใช้สิทธิ์ลดหย่อนในกลุ่ม "ประกันชีวิต + ประกันสุขภาพตนเอง" ให้อัตโนมัติ (รวมเพดานเดียวกัน ไม่เกิน 100,000 บาท)
                        {calc.directorBenefitUsedAsDeduction > 0 && <> — นำไปใช้สิทธิ์ลดหย่อนได้ <b>{fmt(calc.directorBenefitUsedAsDeduction)}</b> บาท</>}
                      </div>
                      {calc.directorBenefitDeductionExcess > 0 && (
                        <div className="excess-box" style={{ marginTop: 8 }}>
                          ⚠️ สิทธิ์ลดหย่อนประกันชีวิต+สุขภาพเดิมเต็มแล้ว (ใช้ไปแล้ว {fmt(calc.lifeHealthExistingUsed)} จาก 100,000 บาท) เบี้ยประกันสวัสดิการนี้จึง<b>ใช้สิทธิ์ลดหย่อนเพิ่มไม่ได้อีก {fmt(calc.directorBenefitDeductionExcess)} บาท</b> (ยังต้องนับเป็นเงินได้เต็มจำนวนเหมือนเดิม แค่ไม่ได้สิทธิ์ลดหย่อนคืนส่วนนี้)
                        </div>
                      )}
                      {calc.directorExtraTaxIfNoGrossUp === 0 && calc.directorBenefitUsedAsDeduction >= num(income.directorBenefitAmt) && (
                        <div className="remaining-box" style={{ marginTop: 8 }}>
                          ✅ เบี้ยประกันสวัสดิการนี้นำไปหักลดหย่อนได้เต็มจำนวนพอดี ทำให้<b>ไม่มีภาระภาษีเพิ่มเลยทั้งสองทางเลือก</b> (สวัสดิการนี้จึงเป็นรายการที่ "ทุนไม่มี" ทางภาษีในกรณีของคุณตอนนี้)
                        </div>
                      )}

                      <button
                        onClick={() => setShowDirectorDetail((v) => !v)}
                        style={{
                          width: "100%", marginTop: 14, padding: "12px 14px", borderRadius: 6, cursor: "pointer",
                          fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 15.5, fontWeight: 800,
                          border: "2px solid #0B3D78", background: "#DCEBF7", color: "#0B3D78",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                        }}
                      >
                        <span>ดูรายละเอียดการคำนวณภาษีทุกขั้นตอน (ก่อน-หลังมีสวัสดิการนี้)</span>
                        <span>{showDirectorDetail ? "▲" : "▼"}</span>
                      </button>
                      {showDirectorDetail && (
                        <div style={{ marginTop: 14 }}>
                          <FullTaxFormCompare calcBefore={calcDirectorNoBenefit} calcAfter={calc} income={income} />
                        </div>
                      )}

                      {income.directorGrossUp && (
                        <>
                          <button
                            onClick={() => setShowGrossUpSteps((v) => !v)}
                            style={{
                              width: "100%", marginTop: 10, padding: "12px 14px", borderRadius: 6, cursor: "pointer",
                              fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 15.5, fontWeight: 800,
                              border: "2px solid #1B5E3A", background: "#E4F5E6", color: "#1B5E3A",
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                            }}
                          >
                            <span>ดูขั้นตอนการคำนวณ Gross-up ทีละขั้น (เลื่อนดูได้)</span>
                            <span>{showGrossUpSteps ? "▲" : "▼"}</span>
                          </button>
                          {showGrossUpSteps && <GrossUpSteps income={income} ded={ded} />}
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ---- ส่วนที่ 3: คำแนะนำซื้อลดหย่อนเพิ่ม ---- */}
          <SectionTitle n="3" title="ซื้อลดหย่อนเพิ่มเท่าไหร่ถึงพอ" sub="แนะนำจำนวนขั้นต่ำที่ควรซื้อเพิ่ม ไม่ใช่การใช้สิทธิ์เต็มทุกบาทซึ่งอาจไม่คุ้มค่า" />
          <div className="sec-card">
            {calc.sDividend > 0 && (
              <div className="rule-text" style={{ marginBottom: 14 }}>
                คำนวณจากวิธีเงินปันผลที่เลือกไว้ในกล่องสรุปด้านบน ({calc.useDividendCredit ? "ใช้เครดิตภาษี" : "ไม่ใช้เครดิต"}) — ตัวเลขด้านล่างคือภาระภาษีที่ต้องจ่ายจริงหลังหักเครดิตแล้ว (ถ้าใช้)
              </div>
            )}
            {calcTrueTax <= 0 ? (
              <div className="full-box">ตอนนี้ไม่มีภาษีที่ต้องชำระอยู่แล้ว ไม่จำเป็นต้องซื้อค่าลดหย่อนเพิ่มเพื่อประหยัดภาษี</div>
            ) : canReachZero ? (
              <div style={{ background: "#DCEBF7", border: "2px solid #17406B", borderRadius: 6, padding: "18px 20px" }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: "#17406B", marginBottom: 6 }}>แนะนำ</div>
                <div style={{ fontSize: 21, fontWeight: 800, color: "#17406B", lineHeight: 1.6 }}>
                  ตอนนี้ต้องเสียภาษี {fmt(calcTrueTax)} บาท — ซื้อค่าลดหย่อนเพิ่มอีกเพียง <span className="mono">{fmt(smartAdd)}</span> บาท
                  {smartFinalTax < 0
                    ? <> ก็เพียงพอให้ไม่ต้องเสียภาษีเลย แถมได้รับเงินคืนภาษีอีก <TaxAmt value={smartFinalTax} colorNegative="#17406B" /> บาท</>
                    : <> ก็เพียงพอให้ภาษีลดลงเหลือ {fmt(smartFinalTax)} บาท</>}
                </div>
                {smartFinalTax > 0 && (
                  <div className="rule-text" style={{ marginTop: 8 }}>
                    ภาษียังไม่เป็น 0 เพราะเข้าเกณฑ์ภาษีขั้นต่ำตามมาตรา 48(2) — วิธีคิด: เงินได้ประเภท (2)-(8) รวม {fmt(calc.nonSalaryIncome240to8)} บาท × 0.5% = <span className="mono">{fmt(calc.taxMin)}</span> บาท
                    {calc.useDividendCredit ? " และ/หรือยังมีภาษีสุทธิหลังหักเครดิตปันผลค้างอยู่" : ""} ซึ่งไม่ขึ้นกับค่าลดหย่อน จึงลดเพิ่มไม่ได้อีกด้วยวิธีนี้
                  </div>
                )}
                {smartFinalTax < 0 && (
                  <div className="rule-text" style={{ marginTop: 8 }}>
                    ที่ยังได้เงินคืนแม้เงินได้สุทธิแตะเกณฑ์ภาษีขั้นต่ำแล้ว เป็นเพราะเครดิตภาษีเงินปันผลเป็นยอดคงที่ ไม่ขึ้นกับค่าลดหย่อนที่ซื้อเพิ่ม
                  </div>
                )}
                <div className="rule-text" style={{ marginTop: 8 }}>
                  เทียบกับการใช้สิทธิ์เต็มทุกบาท ({fmt(roomTotal)} บาท) ซึ่งประหยัดภาษีได้เท่ากันแต่ต้องจ่ายเงินซื้อเพิ่มมากกว่ามาก — จึงไม่จำเป็นต้องซื้อเกินจำนวนที่แนะนำนี้
                </div>
              </div>
            ) : (
              <div style={{ background: "#DCEBF7", border: "2px solid #17406B", borderRadius: 6, padding: "18px 20px" }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: "#17406B", marginBottom: 6 }}>แนะนำ</div>
                <div style={{ fontSize: 21, fontWeight: 800, color: "#17406B", lineHeight: 1.6 }}>
                  แม้ซื้อค่าลดหย่อนเพิ่มจนเต็มสิทธิ์ตามกฎหมายทั้งหมด ({fmt(roomTotal)} บาท) ก็ยังลดภาษีจาก {fmt(calcTrueTax)} บาท ได้เหลือ <TaxAmt value={smartFinalTax} colorNegative="#17406B" /> บาท เท่านั้น
                </div>
                <div className="rule-text" style={{ marginTop: 8 }}>
                  ไม่สามารถทำให้ภาษีเป็น 0 ได้ด้วยค่าลดหย่อน เนื่องจากเพดานตามกฎหมายไม่พอ — หากต้องการซื้อเพิ่ม แนะนำซื้อเท่าที่ใช้สิทธิ์ได้จริงคือ {fmt(roomTotal)} บาท
                </div>
              </div>
            )}

            <details style={{ marginTop: 18 }}>
              <summary style={{ cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#14314F" }}>
                ดูตัวเลขเปรียบเทียบแบบละเอียด (แผนปัจจุบัน / แผนแนะนำ / แผนใช้สิทธิ์เต็มทุกบาท)
              </summary>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 16.5, marginTop: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid #2C6FA8" }}>
                    <th style={{ padding: "10px 6px", fontWeight: 800 }}></th>
                    <th style={{ padding: "10px 6px", fontWeight: 800, textAlign: "right" }}>แผนปัจจุบัน</th>
                    <th style={{ padding: "10px 6px", fontWeight: 800, textAlign: "right", color: "#17406B" }}>แผนแนะนำ</th>
                    <th style={{ padding: "10px 6px", fontWeight: 800, textAlign: "right", color: "#1F6B3D" }}>ใช้สิทธิ์เต็ม</th>
                  </tr>
                </thead>
                <tbody className="mono">
                  <tr style={{ borderBottom: "1px solid #CFE8F0" }}>
                    <td style={{ padding: "9px 6px", fontFamily: "'Noto Sans Thai',sans-serif" }}>เงินได้รวม</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", whiteSpace: "nowrap" }}>{fmt(calc.totalGrossIncome)}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", whiteSpace: "nowrap" }}>{fmt(calc.totalGrossIncome)}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", whiteSpace: "nowrap" }}>{fmt(calc.totalGrossIncome)}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #CFE8F0" }}>
                    <td style={{ padding: "9px 6px", fontFamily: "'Noto Sans Thai',sans-serif" }}>หัก ค่าใช้จ่าย</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", whiteSpace: "nowrap" }}>− {fmt(calc.totalGrossIncome - calc.incomeAfterExpense)}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", whiteSpace: "nowrap" }}>− {fmt(calc.totalGrossIncome - calc.incomeAfterExpense)}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", whiteSpace: "nowrap" }}>− {fmt(calc.totalGrossIncome - calc.incomeAfterExpense)}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #CFE8F0" }}>
                    <td style={{ padding: "9px 6px", fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 700 }}>เงินได้หลังหักค่าใช้จ่าย</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(calc.incomeAfterExpense)}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(calc.incomeAfterExpense)}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(calc.incomeAfterExpense)}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #CFE8F0" }}>
                    <td style={{ padding: "9px 6px", fontFamily: "'Noto Sans Thai',sans-serif" }}>หัก ค่าลดหย่อนเดิม</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", whiteSpace: "nowrap" }}>− {fmt(calc.totalDeductions)}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", whiteSpace: "nowrap" }}>− {fmt(calc.totalDeductions)}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", whiteSpace: "nowrap" }}>− {fmt(calc.totalDeductions)}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #CFE8F0" }}>
                    <td style={{ padding: "9px 6px", fontFamily: "'Noto Sans Thai',sans-serif" }}>หัก ซื้อเพิ่ม</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", whiteSpace: "nowrap" }}>− 0</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 700, color: "#17406B" , whiteSpace: "nowrap" }}>− {fmt(smartAdd)}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 700, color: "#1F6B3D" , whiteSpace: "nowrap" }}>− {fmt(roomTotal)}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #CFE8F0" }}>
                    <td style={{ padding: "9px 6px", fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 700 }}>ค่าลดหย่อนรวม</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(calc.totalDeductions)}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 700, color: "#17406B" , whiteSpace: "nowrap" }}>{fmt(calc.totalDeductions + smartAdd)}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 700, color: "#1F6B3D" , whiteSpace: "nowrap" }}>{fmt(calcMax.totalDeductions)}</td>
                  </tr>
                  <tr style={{ borderBottom: "2px solid #2C6FA8" }}>
                    <td style={{ padding: "9px 6px", fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 800 }}>เงินได้สุทธิ (ฐานภาษี)</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 800, whiteSpace: "nowrap" }}>{fmt(calc.netIncomeTaxable)}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 800, color: "#17406B" , whiteSpace: "nowrap" }}>{fmt(smartNet)}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 800, color: "#1F6B3D" , whiteSpace: "nowrap" }}>{fmt(calcMax.netIncomeTaxable)}</td>
                  </tr>
                  <tr style={{ borderBottom: calc.hasAnyCredit ? "1px solid #CFE8F0" : "2px solid #2C6FA8" }}>
                    <td style={{ padding: "9px 6px", fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 700 }}>ภาษีคำนวณได้ (ก่อนหักเครดิต)</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(calc.finalTax)}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 700, color: "#17406B", whiteSpace: "nowrap" }}>{fmt(smartFinalTaxRaw)}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 700, color: "#1F6B3D", whiteSpace: "nowrap" }}>{fmt(calcMax.finalTax)}</td>
                  </tr>
                  {calc.hasAnyCredit && (
                    <>
                      {calc.dividendCreditAmount > 0 && (
                        <tr style={{ borderBottom: "1px solid #CFE8F0" }}>
                          <td style={{ padding: "9px 6px", fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 14, color: "#6C93A8" }}>หัก เครดิตภาษีเงินปันผล (ม.47 ทวิ)</td>
                          <td style={{ padding: "9px 6px", textAlign: "right", fontSize: 14, color: "#6C93A8", whiteSpace: "nowrap" }}>− {fmt(calc.dividendCreditAmount)}</td>
                          <td style={{ padding: "9px 6px", textAlign: "right", fontSize: 14, color: "#6C93A8", whiteSpace: "nowrap" }}>− {fmt(calc.dividendCreditAmount)}</td>
                          <td style={{ padding: "9px 6px", textAlign: "right", fontSize: 14, color: "#6C93A8", whiteSpace: "nowrap" }}>− {fmt(calc.dividendCreditAmount)}</td>
                        </tr>
                      )}
                      {calc.dividendWht > 0 && (
                        <tr style={{ borderBottom: "1px solid #CFE8F0" }}>
                          <td style={{ padding: "9px 6px", fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 14, color: "#6C93A8" }}>หัก ภาษีเงินปันผลหัก ณ ที่จ่าย</td>
                          <td style={{ padding: "9px 6px", textAlign: "right", fontSize: 14, color: "#6C93A8", whiteSpace: "nowrap" }}>− {fmt(calc.dividendWht)}</td>
                          <td style={{ padding: "9px 6px", textAlign: "right", fontSize: 14, color: "#6C93A8", whiteSpace: "nowrap" }}>− {fmt(calc.dividendWht)}</td>
                          <td style={{ padding: "9px 6px", textAlign: "right", fontSize: 14, color: "#6C93A8", whiteSpace: "nowrap" }}>− {fmt(calc.dividendWht)}</td>
                        </tr>
                      )}
                      {calc.interestWhtCredit > 0 && (
                        <tr style={{ borderBottom: "1px solid #CFE8F0" }}>
                          <td style={{ padding: "9px 6px", fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 14, color: "#6C93A8" }}>หัก ภาษีดอกเบี้ยหัก ณ ที่จ่ายที่ขอเครดิตคืน</td>
                          <td style={{ padding: "9px 6px", textAlign: "right", fontSize: 14, color: "#6C93A8", whiteSpace: "nowrap" }}>− {fmt(calc.interestWhtCredit)}</td>
                          <td style={{ padding: "9px 6px", textAlign: "right", fontSize: 14, color: "#6C93A8", whiteSpace: "nowrap" }}>− {fmt(calc.interestWhtCredit)}</td>
                          <td style={{ padding: "9px 6px", textAlign: "right", fontSize: 14, color: "#6C93A8", whiteSpace: "nowrap" }}>− {fmt(calc.interestWhtCredit)}</td>
                        </tr>
                      )}
                      <tr style={{ borderBottom: "2px solid #2C6FA8" }}>
                        <td style={{ padding: "9px 6px", fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 700 }}>รวมเครดิตทั้งหมด (เท่ากันทุกคอลัมน์ — ไม่ขึ้นกับค่าลดหย่อน)</td>
                        <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>− {fmt(calc.allCreditsTotal)}</td>
                        <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 700, color: "#17406B", whiteSpace: "nowrap" }}>− {fmt(calc.allCreditsTotal)}</td>
                        <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 700, color: "#1F6B3D", whiteSpace: "nowrap" }}>− {fmt(calc.allCreditsTotal)}</td>
                      </tr>
                    </>
                  )}
                  <tr>
                    <td style={{ padding: "9px 6px", fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 800 }}>ภาษีที่ต้องชำระ/ได้คืน (จริง หลังหักเครดิตปันผลถ้าใช้)</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 800, whiteSpace: "nowrap" }}><TaxAmt value={calcTrueTax} /></td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 800, color: smartFinalTax < 0 ? "#1B5E3A" : "#17406B" , whiteSpace: "nowrap" }}><TaxAmt value={smartFinalTax} colorNegative="#1B5E3A" /></td>
                    <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: 800, color: "#1F6B3D" , whiteSpace: "nowrap" }}><TaxAmt value={calcMaxTrueTax} colorNegative="#1F6B3D" /></td>
                  </tr>
                </tbody>
              </table>
            </details>
          </div>

          {/* ---- ส่วนที่ 4: วางแผนลงทุนเงินภาษีที่ประหยัดได้ ---- */}
          <SectionTitle n="4" title="วางแผนลงทุนเงินภาษีที่ประหยัดได้" sub="จำลองว่าถ้าซื้อค่าลดหย่อนเพิ่มเท่านี้ ประหยัดภาษีเท่าไร และถ้านำเงินภาษีที่ประหยัดได้ไปลงทุนต่อจนถึงวัยเกษียณจะโตเป็นเท่าไร" />

          {purchasableItems.length > 0 && (
            <div className="sec-card">
              <FieldTitle en="" th="รายการที่ยังซื้อเพิ่มได้ — เลือกได้หลายรายการ" />
              <div className="rule-text" style={{ marginTop: -8, marginBottom: 14 }}>
                คำนวณจากเพดานตามรายได้ของคุณจริง แตะเพื่อเลือก/ยกเลิก — เลือกได้พร้อมกันหลายตัว แต่ละตัวจะมาโชว์เป็นหัวข้อแยกด้านล่างให้แก้จำนวนเงินเองได้
              </div>

              {purchasableItems.some((i) => i.group) && (
                <div style={{ background: "#FBF6E8", border: "2px solid #A9812F", borderRadius: 6, padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: "#7A5A0F", fontWeight: 700 }}>
                  🟡 รายการกรอบสีทองด้านล่าง = กลุ่มเกษียณ ใช้เพดานรวมกันไม่เกิน 500,000 บาท — ตอนนี้ใช้ไปแล้ว {fmt(calc.retirementGroupTotal)} บาท เหลือ {fmt(Math.max(0, calc.groupMaxAchievable - calc.retirementGroupTotal))} บาท (ยังไม่รวมที่เลือกซื้อในหน้านี้)
                </div>
              )}

              {purchasableItems.map((item) => {
                const isSelected = item.key in planItems;
                return (
                  <button
                    key={item.key}
                    onClick={() => togglePlanItem(item)}
                    style={{
                      width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "'Noto Sans Thai', sans-serif",
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                      border: `2px solid ${isSelected ? "#1B5E3A" : (item.group ? "#A9812F" : "#CFE8F0")}`,
                      background: isSelected ? "#E4F5E6" : (item.group ? "#FBF6E8" : "#FFFFFF"),
                      borderRadius: 6, padding: "13px 16px", marginBottom: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginTop: 2,
                        border: `2px solid ${isSelected ? "#1B5E3A" : "#8C8468"}`, background: isSelected ? "#1B5E3A" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 800,
                      }}>{isSelected ? "✓" : ""}</span>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#0B3D78" }}>{item.label}</div>
                        <div style={{ fontSize: 13, color: "#14314F", marginTop: 2 }}>{item.note}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: "#1B5E3A" }}>+{fmt(item.remaining)}</div>
                      <div style={{ fontSize: 11.5, color: "#14314F" }}>บาท</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="sec-card">
            {selectedItems.length === 0 ? (
              <div className="rule-text">ยังไม่ได้เลือกรายการที่จะซื้อเพิ่ม — เลือกจากรายการด้านบนได้เลย (เลือกได้หลายรายการพร้อมกัน)</div>
            ) : (
              selectedItems.map((item) => {
                const raw = num(planItems[item.key]);
                const exceeds = raw > item.remaining;
                return (
                  <div key={item.key} style={{
                    marginBottom: 20, paddingBottom: 18, padding: item.group ? "14px 16px 18px" : "0 0 18px",
                    borderBottom: "1px solid #CFE8F0", background: item.group ? "#FBF6E8" : "transparent",
                    border: item.group ? "2px solid #A9812F" : "none", borderRadius: item.group ? 6 : 0,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <label className="label-sm" style={{ marginBottom: 0 }}>
                        {item.group && <span style={{ fontSize: 11, fontWeight: 800, color: "#7A5A0F", background: "#F0E2B8", borderRadius: 4, padding: "2px 7px", marginRight: 7 }}>กลุ่มเกษียณ</span>}
                        {item.label} (บาท)
                      </label>
                      <button
                        onClick={() => togglePlanItem(item)}
                        style={{ background: "none", border: "none", color: "#8A241C", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                      >
                        ✕ เอาออก
                      </button>
                    </div>
                    <NumField value={planItems[item.key]} onChange={(v) => setPlanItems((p) => ({ ...p, [item.key]: v }))} placeholder="0" />
                    <div className="rule-text">{item.note}</div>
                    <div className="rule-text">สิทธิ์สูงสุดของรายการนี้: {fmt(item.remaining)} บาท</div>
                    {exceeds && (
                      <div className="excess-box">
                        กรอกเกินสิทธิ์ — ใช้สิทธิ์ได้จริงเพียง {fmt(item.remaining)} บาท ส่วนเกิน {fmt(raw - item.remaining)} บาท ไม่สามารถใช้สิทธิ์ได้ (ระบบคำนวณภาษีจากยอดที่ใช้สิทธิ์ได้จริง)
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {selectedItems.length > 0 && (
              <>
                <div style={{ marginTop: 4, marginBottom: 10, fontSize: 17, fontWeight: 800, color: "#0B3D78" }}>
                  รวมที่วางแผนซื้อเพิ่ม (ใช้สิทธิ์ได้จริงหลังผ่านทุกเพดานแล้ว): {fmt(planAddNum)} บาท
                </div>

                {groupCutByCap > 0.5 && (
                  <div className="excess-box" style={{ marginBottom: 14 }}>
                    รวมกลุ่มเกษียณที่วางแผนซื้อเพิ่ม (ประกันบำนาญ+PVD/กบข.+RMF+SSF+กอช.) เกินเพดานรวม 500,000 บาทที่เหลืออยู่ —
                    ที่ตั้งใจซื้อรวม {fmt(groupSelectedRaw)} บาท แต่ใช้สิทธิ์ได้จริงในกลุ่มนี้เพียง {fmt(groupActualAdded)} บาท
                    (ระบบปรับลดสัดส่วนให้อัตโนมัติเหมือนตอนกรอกในส่วนที่ 2)
                  </div>
                )}

                <div id="print-area-investment">
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, paddingBottom: 12, borderBottom: "2px solid #0B3D78", marginBottom: 4 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#0B3D78" }}>
                      {taxpayerName ? `แผนวางแผนภาษีและการลงทุนของ ${taxpayerName}` : "แผนวางแผนภาษีและการลงทุน"}
                    </div>
                    <div style={{ fontSize: 14, color: "#14314F", fontWeight: 600 }}>ปีภาษี 2569 (ยื่นปี 2570)</div>
                  </div>
                  {(advisorName || advisorPhone) && (
                    <div style={{ fontSize: 14, color: "#14314F", fontWeight: 600, marginBottom: 14 }}>
                      ผู้ให้คำปรึกษา: {advisorName || "-"}{advisorPhone ? ` · โทร ${advisorPhone}` : ""}
                    </div>
                  )}
                  {calc.sDividend > 0 && (
                    <div className="rule-text" style={{ marginBottom: 10 }}>
                      "ก่อนซื้อเพิ่ม" คือแผนตามวิธีเงินปันผลที่เลือกไว้ในกล่องสรุปด้านบน ({calc.useDividendCredit ? "ใช้เครดิตภาษี" : "ไม่ใช้เครดิต"}) — ภาษีที่แสดงเป็นยอดที่ต้องจ่ายจริงหลังหักเครดิตแล้ว ไม่ใช่ยอดก่อนหักเครดิต
                    </div>
                  )}

                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0B3D78", marginBottom: 8 }}>รายการที่แนะนำให้ซื้อเพิ่ม</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15.5 }}>
                    <tbody>
                      {selectedItems.map((item) => (
                        <tr key={item.key} style={{ borderBottom: "1px solid #CFE8F0" }}>
                          <td style={{ padding: "7px 6px", fontFamily: "'Noto Sans Thai',sans-serif" }}>{item.label}</td>
                          <td className="mono" style={{ padding: "7px 6px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
                            {fmt(Math.min(num(planItems[item.key]), item.remaining))} บาท
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td style={{ padding: "7px 6px", fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 800 }}>รวมซื้อเพิ่มทั้งหมด</td>
                        <td className="mono" style={{ padding: "7px 6px", textAlign: "right", fontWeight: 800, whiteSpace: "nowrap" }}>{fmt(planAddNum)} บาท</td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ fontSize: 19, fontWeight: 800, color: "#0B3D78", marginTop: 30, paddingTop: 16, borderTop: "3px double #0B3D78" }}>
                    ใบคำนวณฉบับเต็ม — เทียบก่อน/หลังซื้อค่าลดหย่อนเพิ่ม
                  </div>
                  <FullTaxFormCompare calcBefore={calc} calcAfter={calcPlanned} income={income} />

                  <div style={{ marginTop: 20, background: "#DCEBF7", border: "2px solid #17406B", borderRadius: 6, padding: "16px 18px" }}>
                    <div style={{ fontSize: 19, fontWeight: 800, color: "#17406B" }}>ประหยัดภาษีได้ {fmt(taxSaved)} บาท</div>
                    <div className="rule-text" style={{ marginTop: 4 }}>คำนวณจากส่วนต่างภาษีขั้นบันไดก่อน-หลังซื้อเพิ่ม {fmt(planAddNum)} บาท{calc.usedMinRule && " (รวมผลของเกณฑ์ภาษีขั้นต่ำ ม.48(2) ซึ่งไม่ลดตามค่าลดหย่อนแล้ว)"}</div>
                    {planAddNum > 0 && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #9FC3DE" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#17406B" }}>
                          ลงทุนเพิ่ม {fmt(planAddNum)} บาท → ประหยัดภาษีได้ {fmt(taxSaved)} บาท
                          = ได้ผลประโยชน์คืนทันที <span className="mono">{((taxSaved / planAddNum) * 100).toFixed(1)}%</span> ของเงินที่ซื้อเพิ่ม
                        </div>
                        <div className="rule-text" style={{ marginTop: 4 }}>
                          (ยังไม่รวมผลตอบแทนจากตัวผลิตภัณฑ์ที่ซื้อเอง เช่น ดอกเบี้ย/เงินปันผลจากกองทุน หรือความคุ้มครองจากประกัน)
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="row2" style={{ marginTop: 20 }}>
                    <div>
                      <label className="label-sm">อัตราผลตอบแทนที่คาดหวัง (% ต่อปี)</label>
                      <input className="field-input" type="number" step="0.1" value={planRate} onFocus={handleTapClear} onKeyDown={handleEnterToNext} onInput={(e) => setPlanRate(e.target.value)} placeholder="3" />
                    </div>
                    <div>
                      <label className="label-sm">ระยะเวลาลงทุนจนถึงวัยเกษียณ (ปี)</label>
                      <input className="field-input" readOnly style={{ background: "#EAF6F5" }} value={years} />
                    </div>
                  </div>

                  <div style={{ marginTop: 20, background: "#E4F5E6", border: "2px solid #2CA8D8", borderRadius: 6, padding: "18px 20px" }}>
                    <div style={{ fontSize: 17, color: "#1B5E3A", fontWeight: 700, marginBottom: 6, lineHeight: 1.7 }}>
                      สมมติว่าเงินได้เท่าเดิมทุกปี และซื้อค่าลดหย่อนเพิ่มเท่านี้ทุกปี จะประหยัดภาษีได้ปีละ {fmt(taxSaved)} บาท ต่อเนื่องเป็นเวลา {years} ปีจนถึงวัยเกษียณ
                      — ถ้านำเงินที่ประหยัดได้ในแต่ละปีไปลงทุนสะสมทันทีที่ผลตอบแทน {num(planRate)}% ต่อปี
                    </div>
                    <div style={{ fontSize: 14.5, color: "#1B5E3A", fontWeight: 600, marginBottom: 4 }}>เงินสะสมเมื่อถึงวัยเกษียณ</div>
                    <div className="mono" style={{ fontSize: 30, fontWeight: 800, color: "#1B5E3A" }}>{fmt(futureValueAnnuity)} บาท</div>
                    <div className="rule-text" style={{ marginTop: 8 }}>
                      มาจากเงินภาษีที่ประหยัดได้สะสม {years} ปี รวม {fmt(totalContributed)} บาท และผลตอบแทนจากการลงทุนอีก {fmt(growthExtra)} บาท
                    </div>
                  </div>

                  <div style={{ fontSize: 12.5, color: "#6C93A8", fontWeight: 600, marginTop: 18, paddingTop: 12, borderTop: "1px solid #CFE8F0" }}>
                    จัดทำโดยป้าเป็ด CFP — เป็นการประมาณการเบื้องต้นสำหรับปีภาษี 2569 เท่านั้น ไม่ใช่แบบยื่นภาษีอย่างเป็นทางการ ควรตรวจสอบกับผู้เชี่ยวชาญด้านภาษีก่อนตัดสินใจซื้อจริง
                  </div>
                </div>

                <button
                  onClick={() => {
                    setPrintMode("investment");
                    window.print();
                  }}
                  style={{
                    width: "100%", background: "#1B5E3A", border: "2px solid #1B5E3A", borderRadius: 6,
                    padding: "14px 16px", fontSize: 17, fontWeight: 800, color: "#FFFFFF", cursor: "pointer",
                    fontFamily: "'Noto Sans Thai', sans-serif", marginTop: 20,
                    display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                  }}
                >
                  <span>🖨️ พิมพ์ / บันทึกเป็น PDF ส่งให้ลูกค้า (แผนซื้อเพิ่ม/ผลประโยชน์)</span>
                </button>
                <div className="rule-text" style={{ marginTop: 6 }}>
                  พิมพ์เฉพาะหน้าเปรียบเทียบก่อน-หลังซื้อเพิ่มแบบเต็มฟอร์มด้านบน — ไม่รวมฟอร์มกรอกข้อมูลอื่นๆ ของหน้าเว็บ กดปุ่มนี้แล้วในหน้าต่างพิมพ์ที่เด้งขึ้นมา เลือกปริ้นเตอร์จริงเพื่อพิมพ์ หรือเลือก "Save as PDF" เพื่อบันทึกเป็นไฟล์ PDF ส่งให้ลูกค้าทางไลน์/อีเมลได้เลย
                </div>
              </>
            )}
          </div>
          </div>
          )}
        </div>

        
      </div>

      <footer style={{ maxWidth: 880, margin: "0 auto", padding: "0 20px 60px", fontSize: 15, color: "#14314F", lineHeight: 1.8, fontWeight: 500 }}>
        เครื่องมือนี้จัดทำโดยป้าเป็ด CFP เพื่อใช้ภายในทีมงานสำหรับความสะดวกในการวางแผนภาษีเบื้องต้น เป็นการประมาณการตามหลักเกณฑ์ภาษีเงินได้บุคคลธรรมดาที่ทราบล่าสุดสำหรับปีภาษี 2569 เท่านั้น
        ไม่ใช่แบบยื่นภาษีอย่างเป็นทางการ อัตราและเพดานบางรายการ (เช่น มาตรการกระตุ้นเศรษฐกิจ) อาจเปลี่ยนแปลงตามประกาศกรมสรรพากร
        ควรตรวจสอบกับกรมสรรพากรหรือผู้เชี่ยวชาญด้านภาษีก่อนยื่นแบบจริง
      </footer>
    </div>
  );
}

/* ---------- small components ---------- */
function SectionTitle({ n, title, sub }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", margin: "32px 0 18px" }}>
      <div className="mono" style={{
        fontFamily: "'IBM Plex Mono', monospace", fontWeight: 800, fontSize: 19, color: "#0B3D78",
        border: "2.5px solid #0B3D78", borderRadius: "50%", width: 42, height: 42, display: "flex",
        alignItems: "center", justifyContent: "center", flexShrink: 0, background: "#FFFFFF",
      }}>{n}</div>
      <div>
        <div className="serif" style={{ fontSize: 25, fontWeight: 700, color: "#0B3D78" }}>{title}</div>
        <div style={{ fontSize: 16, color: "#14314F", marginTop: 4, fontWeight: 500 }}>{sub}</div>
      </div>
    </div>
  );
}
function FieldTitle({ en, th }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
      {en && <span className="mono" style={{ fontSize: 14, color: "#0B3D78", fontWeight: 800 }}>{en}</span>}
      <span style={{ fontSize: 20, fontWeight: 800, color: "#0D1826" }}>{th}</span>
    </div>
  );
}
/* CollapsibleCard: accordion wrapper — tap the header to reveal the input fields underneath, keeps the page compact */
function StaticCard({ en, th, children }) {
  return (
    <div className="sec-card">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 }}>
        {en && <span className="mono" style={{ fontSize: 14, color: "#0B3D78", fontWeight: 800 }}>{en}</span>}
        <span style={{ fontSize: 20, fontWeight: 800, color: "#0D1826" }}>{th}</span>
      </div>
      {children}
    </div>
  );
}

// GroupCheckbox: ใช้ในแท็บ 1 (เลือกรายการ) และในกล่อง "เพิ่มรายการอื่น" ของแท็บ 2 — ติ๊กกลุ่มใหญ่แล้วกางรายการย่อยให้ติ๊กต่อถ้ามี
function GroupCheckbox({ group, selectedGroups, toggleGroup, selectedSubItems, toggleSubItem }) {
  const checked = !!selectedGroups[group.id];
  return (
    <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #EAF1F5" }}>
      <label className="checkbox-row">
        <input type="checkbox" checked={checked} onChange={() => toggleGroup(group.id)} />
        {group.en && <span className="mono" style={{ fontSize: 13, color: "#0B3D78", marginRight: 6 }}>{group.en}</span>}
        {group.label}
      </label>
      {checked && group.subItems && (
        <div style={{ marginLeft: 32, marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {group.subItems.map((si) => (
            <label key={si.id} className="checkbox-row" style={{ fontSize: 15, fontWeight: 500 }}>
              <input type="checkbox" checked={!!selectedSubItems[`${group.id}:${si.id}`]} onChange={() => toggleSubItem(group.id, si.id)} />
              {si.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}>
      <span style={{ color: "#0B3D78", fontWeight: 600 }}>{label}</span>
      <span className="mono" style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}
function SummaryLine({ label, value, sign, bold, big }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}>
      <span style={{ fontSize: big ? 17 : 15.5, color: "#DCEFFA", fontWeight: 600 }}>{label}</span>
      <span className="mono" style={{ fontSize: big ? 24 : 17, fontWeight: bold ? 800 : 600, color: big ? "#FBFAF3" : "#BFE3F0" }}>
        {sign === "-" ? "− " : ""}{fmt(value)}
      </span>
    </div>
  );
}
/* ProportionChart: visual breakdown of total income into expense / deductions / tax / take-home */
function ProportionChart({ calc }) {
  const total = calc.totalGrossIncome;
  if (!total || total <= 0) return null;

  const taxAmt = calc.hasAnyCredit ? Math.max(0, calc.netTaxAfterDividendCredit) : calc.finalTax;
  const rest = Math.max(0, total - taxAmt);
  const taxPct = (taxAmt / total) * 100;

  const segments = [
    { label: "ภาษีที่ต้องชำระ", value: taxAmt, color: "#8A241C", text: "#FFFFFF" },
    { label: "เงินได้ส่วนที่เหลือ (ไม่รวมภาษี)", value: rest, color: "#1B5E3A", text: "#FFFFFF" },
  ].filter((s) => s.value > 0.5);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#0B3D78", marginBottom: 4 }}>
        เงินได้รวม {fmt(total)} บาท เสียภาษีจริง {fmt(taxAmt)} บาท
      </div>
      <div style={{ fontSize: 13.5, color: "#6C93A8", marginBottom: 10 }}>
        คิดเป็น {taxPct.toFixed(1)}% ของเงินได้รวม (อัตราภาษีที่แท้จริง)
      </div>
      <div style={{ display: "flex", width: "100%", height: 34, borderRadius: 6, overflow: "hidden", border: "1px solid #A9D8E8" }}>
        {segments.map((s, i) => (
          <div
            key={i}
            style={{
              width: `${(s.value / total) * 100}%`, background: s.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11.5, fontWeight: 800, color: s.text, fontFamily: "'IBM Plex Mono', monospace",
              minWidth: (s.value / total) * 100 > 5 ? "auto" : 0, overflow: "hidden", whiteSpace: "nowrap",
            }}
            title={`${s.label}: ${fmt(s.value)} บาท`}
          >
            {(s.value / total) * 100 >= 8 ? `${((s.value / total) * 100).toFixed(0)}%` : ""}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px", marginTop: 12 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0, display: "inline-block" }} />
            <span style={{ color: "#14314F", fontWeight: 600 }}>{s.label}</span>
            <span className="mono" style={{ color: "#0D1826", fontWeight: 800 }}>{fmt(s.value)}</span>
            <span style={{ color: "#6C93A8" }}>({((s.value / total) * 100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function DetailHeading({ children }) {
  return (
    <div style={{ fontSize: 16.5, fontWeight: 800, color: "#0B3D78", marginTop: 18, marginBottom: 8, paddingBottom: 6, borderBottom: "2px solid #A9D8E8" }}>
      {children}
    </div>
  );
}
// TaxAmt: แสดงจำนวนภาษี — ถ้าติดลบ (ได้เงินคืน) จะขึ้นคำว่า "คืน" แทนเครื่องหมายลบ กันสับสนว่ายังต้องจ่ายอยู่หรือเปล่า
function TaxAmt({ value, colorNegative }) {
  const isNeg = value < 0;
  return <span style={{ color: isNeg ? (colorNegative || "#1B5E3A") : "inherit" }}>{isNeg ? `คืน ${fmt(Math.abs(value))}` : fmt(value)}</span>;
}
function DetailRow({ label, value, bold, sign, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", fontSize: 15.5 }}>
      <span style={{ color: "#14314F", fontWeight: bold ? 800 : 500 }}>{label}</span>
      <span className="mono" style={{ fontWeight: bold ? 800 : 600, color: color || "#0D1826", whiteSpace: "nowrap" }}>
        {sign === "-" ? "− " : ""}{fmt(value)}
      </span>
    </div>
  );
}

// BigResultRow: บรรทัดผลลัพธ์สุดท้าย (ต้องจ่ายเพิ่ม/ได้คืน) — เด่นชัดกว่าบรรทัดอื่นเพราะเป็นตัวเลขที่สำคัญที่สุดในใบสรุป
// isRefund=true (ได้คืน) ใช้โทนเขียว, false (ต้องจ่ายเพิ่ม) ใช้โทนแดง
function BigResultRow({ label, value, isRefund }) {
  const c = isRefund ? "#1B5E3A" : "#8A241C";
  return (
    <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "12px 14px", borderRadius: 6, background: isRefund ? "#E4F5E6" : "#FBEAE8", border: `2px solid ${c}` }}>
      <span style={{ fontSize: 16, fontWeight: 800, color: c }}>{label}</span>
      <span className="mono" style={{ fontSize: 26, fontWeight: 800, color: c, whiteSpace: "nowrap" }}>{fmt(value)} บาท</span>
    </div>
  );
}

// FullTaxForm: ใบสรุปการคำนวณฉบับเต็มแบบละเอียดทุกบรรทัด (รายได้ทีละมาตรา + ค่าลดหย่อนทีละรายการ + สรุปภาษี)
// ใช้ calc ตัวไหนก็ได้ที่มาจาก buildCalc() — จะได้ตัวเลขที่ตรงกับ calc นั้นเป๊ะ ไม่ว่าจะเป็นก่อนซื้อเพิ่มหรือหลังซื้อเพิ่ม
function FullTaxForm({ calc, income }) {
  return (
    <>
      <ProportionChart calc={calc} />

      <DetailHeading>เงินได้พึงประเมินตามที่กรอก (ก่อนหักค่าใช้จ่าย)</DetailHeading>
      {(num(income.salary)) > 0 && <DetailRow label="40(1) เงินเดือน/ค่าจ้าง/โบนัส" value={num(income.salary)} />}
      {(calc.directorBenefitTaxable) > 0 && <DetailRow label="40(1) สวัสดิการกรรมการ (เบี้ยประกัน)" value={calc.directorBenefitTaxable} />}
      {(calc.directorGrossUp ? calc.directorGrossUpAmount : 0) > 0 && <DetailRow label="40(1) ภาษีที่บริษัทออกให้ (Gross-up)" value={calc.directorGrossUpAmount} />}
      {(num(income.commission)) > 0 && <DetailRow label="40(2) ค่านายหน้า/เบี้ยประชุม/ค่าธรรมเนียม" value={num(income.commission)} />}
      {(num(income.royalty)) > 0 && <DetailRow label="40(3) ค่าลิขสิทธิ์" value={num(income.royalty)} />}
      {(num(income.interestAmt)) > 0 && <DetailRow label={`40(4) ดอกเบี้ย${!income.excludeInterest ? "" : " (เลือกใช้ Final Tax ไม่รวมคำนวณ)"}`} value={num(income.interestAmt)} />}
      {(calc.sDividend) > 0 && <DetailRow label={`40(4) เงินปันผล — วิธีที่ใช้: ${income.dividendMode === "credit" ? "เครดิตภาษี" : "หัก ณ ที่จ่าย 10% แบบ Final Tax"}`} value={calc.sDividend} />}
      {(calc.cryptoGain) > 0 && <DetailRow label="40(4)(ฌ) กำไรจากคริปโท/สินทรัพย์ดิจิทัล" value={calc.cryptoGain} />}
      {(num(income.rentalAmt)) > 0 && <DetailRow label="40(5) ค่าเช่าทรัพย์สิน" value={num(income.rentalAmt)} />}
      {(num(income.profAmt)) > 0 && <DetailRow label="40(6) วิชาชีพอิสระ" value={num(income.profAmt)} />}
      {(num(income.bizAmt)) > 0 && <DetailRow label="40(7)+(8) ธุรกิจ/รับเหมา/อื่นๆ" value={num(income.bizAmt)} />}
      <DetailRow label="รวมเงินได้พึงประเมินทั้งหมด" value={calc.totalGrossIncome} bold />

      <DetailHeading>ค่าใช้จ่ายที่หักได้ตามกฎหมาย และเงินได้หลังหักค่าใช้จ่าย</DetailHeading>
      {(calc.exp12) > 0 && <DetailRow label="40(1)+(2) เงินเดือน/ค่านายหน้า — ค่าใช้จ่ายที่หัก" value={calc.exp12} />}
      {(calc.netBySection.s12) > 0 && <DetailRow label="40(1)+(2) เงินได้หลังหักค่าใช้จ่าย" value={calc.netBySection.s12} />}
      {(calc.exp3) > 0 && <DetailRow label="40(3) ค่าลิขสิทธิ์ — ค่าใช้จ่ายที่หัก" value={calc.exp3} />}
      {(calc.netBySection.s3) > 0 && <DetailRow label="40(3) เงินได้หลังหักค่าใช้จ่าย" value={calc.netBySection.s3} />}
      {(calc.netBySection.s4) > 0 && <DetailRow label="40(4) ดอกเบี้ย/เงินปันผล ที่นำมารวมคำนวณ (หลัง gross-up ถ้าใช้เครดิต — หักค่าใช้จ่ายไม่ได้)" value={calc.netBySection.s4} />}
      {(calc.exp5) > 0 && <DetailRow label="40(5) ค่าเช่า — ค่าใช้จ่ายที่หัก" value={calc.exp5} />}
      {(calc.netBySection.s5) > 0 && <DetailRow label="40(5) เงินได้หลังหักค่าใช้จ่าย" value={calc.netBySection.s5} />}
      {(calc.exp6) > 0 && <DetailRow label="40(6) วิชาชีพอิสระ — ค่าใช้จ่ายที่หัก" value={calc.exp6} />}
      {(calc.netBySection.s6) > 0 && <DetailRow label="40(6) เงินได้หลังหักค่าใช้จ่าย" value={calc.netBySection.s6} />}
      {(calc.exp78) > 0 && <DetailRow label="40(7)+(8) ธุรกิจ/รับเหมา/อื่นๆ — ค่าใช้จ่ายที่หัก" value={calc.exp78} />}
      {(calc.netBySection.s78) > 0 && <DetailRow label="40(7)+(8) เงินได้หลังหักค่าใช้จ่าย" value={calc.netBySection.s78} />}
      <DetailRow label="รวมเงินได้หลังหักค่าใช้จ่ายทุกประเภท" value={calc.incomeAfterExpense} bold />

      {calc.elderlyDisabledExemption > 0 && (
        <>
          <DetailHeading>เงินได้ที่ได้รับยกเว้นภาษี (ไม่ใช่ค่าลดหย่อน)</DetailHeading>
          <DetailRow label={`ยกเว้นเงินได้ ${calc.isElderly ? "ผู้สูงอายุ 65 ปีขึ้นไป" : "ผู้พิการ"} (ตนเอง) 190,000 บาทแรก`} value={calc.elderlyDisabledExemption} sign="-" />
          <DetailRow label="เงินได้คงเหลือหลังหักส่วนที่ได้รับยกเว้น" value={calc.incomeAfterExemption} bold />
        </>
      )}

      <DetailHeading>ค่าลดหย่อนที่นำมาใช้จริง</DetailHeading>
      <DetailRow label="ส่วนตัว" value={calc.dPersonal} />
      {(calc.dSpouse) > 0 && <DetailRow label="คู่สมรส" value={calc.dSpouse} />}
      {(calc.dChildren) > 0 && <DetailRow label="บุตร" value={calc.dChildren} />}
      {(calc.dParents) > 0 && <DetailRow label="เลี้ยงดูบิดามารดา" value={calc.dParents} />}
      {(calc.dDisabled) > 0 && <DetailRow label="ผู้พิการ/ทุพพลภาพ" value={calc.dDisabled} />}
      {(calc.dSocial) > 0 && <DetailRow label="ประกันสังคม" value={calc.dSocial} />}
      {(calc.dLifeHealth) > 0 && <DetailRow label="ประกันชีวิต + ประกันสุขภาพตนเอง" value={calc.dLifeHealth} />}
      {(calc.dSpouseInsurance) > 0 && <DetailRow label="ประกันชีวิตคู่สมรส (ไม่มีเงินได้)" value={calc.dSpouseInsurance} />}
      {(calc.dParentHealth) > 0 && <DetailRow label="ประกันสุขภาพบิดามารดา" value={calc.dParentHealth} />}
      {(calc.dAnnuityFinal) > 0 && <DetailRow label="ประกันชีวิตแบบบำนาญ" value={calc.dAnnuityFinal} />}
      {(calc.dPvdFinal) > 0 && <DetailRow label="กองทุนสำรองเลี้ยงชีพ/กบข." value={calc.dPvdFinal} />}
      {(calc.dRmfFinal) > 0 && <DetailRow label="RMF" value={calc.dRmfFinal} />}
      {(calc.dSsfFinal) > 0 && <DetailRow label="SSF" value={calc.dSsfFinal} />}
      {(calc.dNsfFinal) > 0 && <DetailRow label="กอช." value={calc.dNsfFinal} />}
      {(calc.dTeacherFundFinal) > 0 && <DetailRow label="กองทุนสงเคราะห์ครูโรงเรียนเอกชน" value={calc.dTeacherFundFinal} />}
      {(calc.dTesg) > 0 && <DetailRow label="Thai ESG Fund" value={calc.dTesg} />}
      {(calc.dThaiesgx) > 0 && <DetailRow label="Thai ESGX" value={calc.dThaiesgx} />}
      {(calc.dHomeInterest) > 0 && <DetailRow label="ดอกเบี้ยที่อยู่อาศัย" value={calc.dHomeInterest} />}
      {(calc.dDonation) > 0 && <DetailRow label="เงินบริจาค (ทั่วไป + 2 เท่า)" value={calc.dDonation} />}
      {(calc.dPartyDonate) > 0 && <DetailRow label="บริจาคพรรคการเมือง" value={calc.dPartyDonate} />}
      {(calc.dMaternity) > 0 && <DetailRow label="ค่าฝากครรภ์/คลอดบุตร" value={calc.dMaternity} />}
      {(calc.dEasyReceipt) > 0 && <DetailRow label="มาตรการกระตุ้นเศรษฐกิจ" value={calc.dEasyReceipt} />}
      <DetailRow label="รวมค่าลดหย่อนทั้งหมด" value={calc.totalDeductions} bold />

      <DetailHeading>สรุปฐานภาษีและภาษีที่ต้องชำระ</DetailHeading>
      <DetailRow label={calc.elderlyDisabledExemption > 0 ? "เงินได้หลังหักค่าใช้จ่าย/เงินได้ยกเว้น" : "เงินได้หลังหักค่าใช้จ่าย"} value={calc.incomeAfterExemption} />
      <DetailRow label="หัก ค่าลดหย่อนรวม" value={calc.totalDeductions} sign="-" />
      <DetailRow label="เงินได้สุทธิ (ฐานภาษี)" value={calc.netIncomeTaxable} bold />
      <DetailRow label="ภาษีคำนวณตามอัตราก้าวหน้า" value={calc.taxProgressive} />
      {calc.usedMinRule && <DetailRow label="ภาษีขั้นต่ำตามมาตรา 48(2) (0.5% ของเงินได้ (2)-(8)) — ใช้ยอดนี้แทน" value={calc.taxMin} />}
      {calc.hasAnyCredit && (
        <>
          {(calc.dividendCreditAmount) > 0 && <DetailRow label="หัก เครดิตภาษีเงินปันผล (ม.47 ทวิ)" value={calc.dividendCreditAmount} sign="-" />}
          {(calc.dividendWht) > 0 && <DetailRow label="หัก ภาษีเงินปันผลหัก ณ ที่จ่าย (10%)" value={calc.dividendWht} sign="-" />}
          {(calc.interestWhtCredit) > 0 && <DetailRow label="หัก ภาษีดอกเบี้ยหัก ณ ที่จ่าย (15%) ที่ขอเครดิตคืน" value={calc.interestWhtCredit} sign="-" />}
        </>
      )}
      <div style={{ height: 2, background: "#0B3D78", margin: "10px 0" }} />
      <BigResultRow
        label={calc.hasAnyCredit && calc.isDividendRefund ? "ได้รับเงินคืนภาษีจากการยื่นแบบ" : "ภาษีจากการยื่นแบบที่ต้องชำระ"}
        value={calc.hasAnyCredit ? Math.abs(calc.netTaxAfterDividendCredit) : calc.finalTax}
        isRefund={calc.hasAnyCredit ? calc.isDividendRefund : calc.finalTax <= 0}
      />
      {calc.withholdingPaid > 0 && (
        <>
          <DetailRow label="หัก ภาษีที่ถูกหักไว้แล้วระหว่างปี (WHT)" value={calc.withholdingPaid} sign="-" />
          <div style={{ height: 2, background: "#0B3D78", margin: "10px 0" }} />
          <BigResultRow
            label={calc.isOverallRefund ? "ได้รับเงินคืนภาษี" : "ต้องชำระภาษีเพิ่ม"}
            value={Math.abs(calc.netPayableAfterWithholding)}
            isRefund={calc.isOverallRefund}
          />
        </>
      )}
      {calc.totalFinalTaxWithheld > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#9AA7BD", textAlign: "left", lineHeight: 1.7 }}>
          หมายเหตุ: มีภาษี Final Tax ที่ถูกหักไปแล้ว (ดอกเบี้ย/ปันผลที่เลือกไม่รวมคำนวณ) อีก {fmt(calc.totalFinalTaxWithheld)} บาท ซึ่งจบไปแล้ว ไม่ต้องยื่นเพิ่ม —
          รวมภาระภาษีที่แท้จริงทั้งหมด {fmt(Math.abs(calc.totalRealTaxBurden))} บาท (เพื่อทราบไว้เฉยๆ ไม่ใช่ยอดที่ต้องยื่นชำระเพิ่ม)
        </div>
      )}
    </>
  );
}

// ComparisonRow: เหมือน DetailRow แต่โชว์ 2 คอลัมน์ (ก่อน/หลัง) เทียบกันในบรรทัดเดียว
function ComparisonRow({ label, before, after, bold, sign, colorAfter }) {
  const changed = before !== after;
  return (
    <div style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 14.5, borderBottom: "1px solid #EEF6F8" }}>
      <span style={{ flex: "1 1 38%", color: "#14314F", fontWeight: bold ? 800 : 500 }}>{label}</span>
      <span className="mono" style={{ flex: "1 1 31%", textAlign: "right", fontWeight: bold ? 800 : 600, color: "#0D1826" }}>
        {sign === "-" ? "− " : ""}{fmt(before)}
      </span>
      <span className="mono" style={{ flex: "1 1 31%", textAlign: "right", fontWeight: bold || changed ? 800 : 600, color: changed ? (colorAfter || "#1B5E3A") : "#0D1826" }}>
        {sign === "-" ? "− " : ""}{fmt(after)}
      </span>
    </div>
  );
}

// ComparisonRowSplit: ถ้ามีการซื้อเพิ่มรายการนี้จริง แยกเป็น 2 บรรทัดชัดเจน (เดิม / ซื้อเพิ่ม) แทนที่จะยัดรวมกันบรรทัดเดียว
function ComparisonRowSplit({ label, before, after }) {
  const diff = after - before;
  if (diff <= 0) return <ComparisonRow label={label} before={before} after={after} />;
  return (
    <>
      <ComparisonRow label={`${label} (เดิม)`} before={before} after={before} />
      <ComparisonRow label={`${label} (ซื้อเพิ่มจากแผนนี้)`} before={0} after={diff} colorAfter="#1B5E3A" />
    </>
  );
}

// ComparisonFinalTaxRow: แถวภาษีจากการยื่นแบบบรรทัดสุดท้าย — ตัดสิน "ต้องชำระ/ได้คืน" แยกอิสระของแต่ละคอลัมน์ (ก่อน/หลัง)
// สำคัญ: ห้ามใช้ label เดียวร่วมกันทั้งสองฝั่งแบบเดิม เพราะถ้าฝั่งใดฝั่งหนึ่งมีเครดิตเกินจนกลายเป็นเงินคืนไปแล้ว จะแสดงผิดเป็น "ต้องชำระ" ทั้งที่จริงคือ "ได้คืน"
function ComparisonFinalTaxRow({ calcBefore, calcAfter }) {
  const beforeVal = calcBefore.hasAnyCredit ? calcBefore.netTaxAfterDividendCredit : calcBefore.finalTax;
  const afterVal = calcAfter.hasAnyCredit ? calcAfter.netTaxAfterDividendCredit : calcAfter.finalTax;
  const beforeRefund = beforeVal < 0;
  const afterRefund = afterVal < 0;
  return (
    <div style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 14.5, borderBottom: "1px solid #EEF6F8" }}>
      <span style={{ flex: "1 1 38%", color: "#14314F", fontWeight: 800 }}>ภาษีจากการยื่นแบบ (ต้องชำระ/ได้คืน)</span>
      <span className="mono" style={{ flex: "1 1 31%", textAlign: "right", fontWeight: 800, color: beforeRefund ? "#1B5E3A" : "#8A241C" }}>
        {beforeRefund ? "คืน " : ""}{fmt(Math.abs(beforeVal))}
      </span>
      <span className="mono" style={{ flex: "1 1 31%", textAlign: "right", fontWeight: 800, color: afterRefund ? "#1B5E3A" : "#8A241C" }}>
        {afterRefund ? "คืน " : ""}{fmt(Math.abs(afterVal))}
      </span>
    </div>
  );
}

// FullTaxFormCompare: ใบคำนวณฉบับเต็มแบบเทียบก่อน-หลังคู่กันทุกบรรทัด ใช้สำหรับส่วนที่ 4 (ก่อนซื้อเพิ่ม vs หลังซื้อเพิ่ม)
// GrossUpSteps: แสดงขั้นตอนการคำนวณ Gross-up ทีละขั้น เรียงตามแนวนอน เลื่อนดูได้ (สำหรับสวัสดิการกรรมการ)
// GrossUpSteps: แสดงการคำนวณ Gross-up แบบวนซ้ำจริงทีละรอบ เรียงตามแนวนอน เลื่อนดูได้ จนกว่าจะลู่เข้า (converge)
function GrossUpSteps({ income, ded }) {
  const { rounds, baselineTax, finalG, benefitRaw } = useMemo(() => computeGrossUpRounds(income, ded), [income, ded]);

  return (
    <div style={{ marginTop: 14 }}>
      <div className="rule-text" style={{ marginBottom: 4 }}>
        ภาษีที่คำนวณได้แต่ละรอบ จะถูกนำไปทบเป็นเงินได้เพิ่มในรอบถัดไป (เพราะเงินภาษีที่บริษัทออกให้ก็ถือเป็นเงินได้อีกต่อหนึ่ง) วนแบบนี้ไปเรื่อยๆ จนกว่าส่วนที่ต้องทบเพิ่มจะเข้าใกล้ 0 บาท
      </div>
      <div className="rule-text" style={{ marginBottom: 8 }}>
        ใช้ทั้งหมด <b>{rounds.length} รอบ</b> จึงจะลงตัว (ภาษีก่อนหักลดหย่อนพื้นฐาน = {fmt(baselineTax)} บาท) — เลื่อนไปทางขวาเพื่อดูรอบถัดไป →
      </div>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 10, WebkitOverflowScrolling: "touch" }}>
        {rounds.map((r, i) => {
          const isLast = i === rounds.length - 1;
          return (
            <div key={r.round} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              <div
                style={{
                  minWidth: 220, maxWidth: 220, borderRadius: 8, padding: "14px 14px",
                  border: isLast ? "2.5px solid #1B5E3A" : "2px solid #CFE8F0",
                  background: isLast ? "#E4F5E6" : "#FFFFFF",
                }}
              >
                <div className="mono" style={{ fontSize: 12, color: "#6C93A8", fontWeight: 800, marginBottom: 10 }}>
                  รอบที่ {r.round}{isLast ? " (ลงตัว)" : ""}
                </div>

                <div style={{ fontSize: 11.5, color: "#6C93A8" }}>รายได้เดิม (เงินเดือนฯลฯ)</div>
                <div className="mono" style={{ fontSize: 13.5, fontWeight: 600, color: "#0D1826", marginBottom: 4 }}>{fmt(r.baseIncomeOnly)}</div>

                <div style={{ fontSize: 11.5, color: "#6C93A8" }}>+ {r.round === 1 ? "สวัสดิการ (รอบนี้)" : "สวัสดิการ + G ที่ทบมา"}</div>
                <div className="mono" style={{ fontSize: 13.5, fontWeight: 600, color: "#0D1826", marginBottom: 6 }}>{fmt(r.benefitPlusG)}</div>

                <div style={{ borderTop: "1px solid #CFE8F0", paddingTop: 4, fontSize: 11.5, color: "#6C93A8" }}>= รวม</div>
                <div className="mono" style={{ fontSize: 14.5, fontWeight: 800, color: "#0B3D78", marginBottom: 6 }}>{fmt(r.totalGrossIncome)}</div>

                <div style={{ fontSize: 11.5, color: "#6C93A8" }}>− หักค่าใช้จ่าย</div>
                <div className="mono" style={{ fontSize: 13.5, fontWeight: 600, color: "#8A241C", marginBottom: 4 }}>({fmt(r.expenseDeducted)})</div>

                <div style={{ borderTop: "1px solid #CFE8F0", paddingTop: 4, fontSize: 11.5, color: "#6C93A8" }}>= เหลือ</div>
                <div className="mono" style={{ fontSize: 13.5, fontWeight: 700, color: "#0D1826", marginBottom: 6 }}>{fmt(r.incomeAfterExpense)}</div>

                <div style={{ fontSize: 11.5, color: "#6C93A8" }}>− หักค่าลดหย่อน</div>
                <div className="mono" style={{ fontSize: 13.5, fontWeight: 600, color: "#8A241C", marginBottom: 4 }}>({fmt(r.totalDeductions)})</div>

                <div style={{ borderTop: "1px solid #CFE8F0", paddingTop: 4, fontSize: 11.5, color: "#6C93A8" }}>= ฐานภาษี</div>
                <div className="mono" style={{ fontSize: 13.5, fontWeight: 700, color: "#0D1826", marginBottom: 8 }}>{fmt(r.netIncomeTaxable)}</div>

                <div style={{ borderTop: "2px solid #EAF1F5", paddingTop: 6, fontSize: 11.5, color: "#0B3D78", fontWeight: 700 }}>ภาษีคำนวณได้</div>
                <div className="mono" style={{ fontSize: 17, fontWeight: 800, color: "#0B3D78", marginBottom: 8 }}>{fmt(r.taxComputed)} ⭐</div>

                <div style={{ height: 1, background: "#EAF1F5", margin: "8px 0" }} />

                <div style={{ fontSize: 11.5, color: isLast ? "#1B5E3A" : "#A9812F", marginBottom: 1 }}>
                  {isLast ? "ส่วนที่ต้องทบเพิ่ม (ลงตัวแล้ว)" : "↓ ทบเพิ่มรอบถัดไป"}
                </div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: isLast ? "#1B5E3A" : "#A9812F" }}>
                  {isLast ? "≈ 0" : `+${fmt(r.increment)}`}
                </div>
              </div>
              {!isLast && (
                <div style={{ fontSize: 22, color: "#6C93A8", padding: "0 6px", flexShrink: 0 }}>→</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, background: "#F3F1EC", borderRadius: 6, padding: "12px 14px" }}>
        <div style={{ fontSize: 14.5, color: "#14314F", lineHeight: 1.7 }}>
          สรุป: บริษัทต้องออกเงินภาษีให้ทั้งหมด <b className="mono">{fmt(finalG)}</b> บาท (ผลลัพธ์สุดท้ายหลังวนครบ {rounds.length} รอบ) — รวมกับเบี้ยประกัน {fmt(benefitRaw)} บาท เป็นเงินที่บริษัทต้องจ่ายทั้งหมด <b className="mono">{fmt(benefitRaw + finalG)}</b> บาท
        </div>
      </div>
    </div>
  );
}


function FullTaxFormCompare({ calcBefore, calcAfter, income }) {
  return (
    <>
      <div style={{ display: "flex", gap: 8, padding: "8px 0", borderBottom: "2px solid #2C6FA8", fontWeight: 800, fontSize: 14 }}>
        <span style={{ flex: "1 1 38%" }}></span>
        <span style={{ flex: "1 1 31%", textAlign: "right", color: "#14314F" }}>ก่อนซื้อเพิ่ม</span>
        <span style={{ flex: "1 1 31%", textAlign: "right", color: "#1B5E3A" }}>หลังซื้อเพิ่ม</span>
      </div>

      <DetailHeading>เงินได้พึงประเมินตามที่กรอก (ก่อนหักค่าใช้จ่าย)</DetailHeading>
      {(num(income.salary)) > 0 && <ComparisonRow label="40(1) เงินเดือน/ค่าจ้าง/โบนัส" before={num(income.salary)} after={num(income.salary)} />}
      {(calcBefore.directorBenefitTaxable > 0 || calcAfter.directorBenefitTaxable > 0) && <ComparisonRow label="40(1) สวัสดิการกรรมการ (เบี้ยประกัน)" before={calcBefore.directorBenefitTaxable} after={calcAfter.directorBenefitTaxable} colorAfter="#8A241C" />}
      {((calcBefore.directorGrossUp ? calcBefore.directorGrossUpAmount : 0) > 0 || (calcAfter.directorGrossUp ? calcAfter.directorGrossUpAmount : 0) > 0) && <ComparisonRow label="40(1) ภาษีที่บริษัทออกให้ (Gross-up)" before={calcBefore.directorGrossUp ? calcBefore.directorGrossUpAmount : 0} after={calcAfter.directorGrossUp ? calcAfter.directorGrossUpAmount : 0} colorAfter="#8A241C" />}
      {(num(income.commission)) > 0 && <ComparisonRow label="40(2) ค่านายหน้า/เบี้ยประชุม/ค่าธรรมเนียม" before={num(income.commission)} after={num(income.commission)} />}
      {(num(income.royalty)) > 0 && <ComparisonRow label="40(3) ค่าลิขสิทธิ์" before={num(income.royalty)} after={num(income.royalty)} />}
      {(num(income.interestAmt)) > 0 && <ComparisonRow label={`40(4) ดอกเบี้ย${!income.excludeInterest ? "" : " (Final Tax)"}`} before={num(income.interestAmt)} after={num(income.interestAmt)} />}
      {(calcBefore.sDividend) > 0 && <ComparisonRow label={`40(4) เงินปันผล (${income.dividendMode === "credit" ? "เครดิตภาษี" : "Final Tax 10%"})`} before={calcBefore.sDividend} after={calcBefore.sDividend} />}
      {(calcBefore.cryptoGain > 0 || calcAfter.cryptoGain > 0) && <ComparisonRow label="40(4)(ฌ) กำไรจากคริปโท/สินทรัพย์ดิจิทัล" before={calcBefore.cryptoGain} after={calcAfter.cryptoGain} />}
      {(num(income.rentalAmt)) > 0 && <ComparisonRow label="40(5) ค่าเช่าทรัพย์สิน" before={num(income.rentalAmt)} after={num(income.rentalAmt)} />}
      {(num(income.profAmt)) > 0 && <ComparisonRow label="40(6) วิชาชีพอิสระ" before={num(income.profAmt)} after={num(income.profAmt)} />}
      {(num(income.bizAmt)) > 0 && <ComparisonRow label="40(7)+(8) ธุรกิจ/รับเหมา/อื่นๆ" before={num(income.bizAmt)} after={num(income.bizAmt)} />}
      <ComparisonRow label="รวมเงินได้พึงประเมินทั้งหมด" before={calcBefore.totalGrossIncome} after={calcAfter.totalGrossIncome} bold />

      <DetailHeading>ค่าใช้จ่ายที่หักได้ตามกฎหมาย และเงินได้หลังหักค่าใช้จ่าย</DetailHeading>
      {(calcBefore.exp12) > 0 && <ComparisonRow label="40(1)+(2) เงินเดือน/ค่านายหน้า — ค่าใช้จ่ายที่หัก" before={calcBefore.exp12} after={calcAfter.exp12} />}
      {(calcBefore.netBySection.s12) > 0 && <ComparisonRow label="40(1)+(2) เงินได้หลังหักค่าใช้จ่าย" before={calcBefore.netBySection.s12} after={calcAfter.netBySection.s12} />}
      {(calcBefore.exp3) > 0 && <ComparisonRow label="40(3) ค่าลิขสิทธิ์ — ค่าใช้จ่ายที่หัก" before={calcBefore.exp3} after={calcAfter.exp3} />}
      {(calcBefore.netBySection.s3) > 0 && <ComparisonRow label="40(3) เงินได้หลังหักค่าใช้จ่าย" before={calcBefore.netBySection.s3} after={calcAfter.netBySection.s3} />}
      {(calcBefore.netBySection.s4) > 0 && <ComparisonRow label="40(4) ดอกเบี้ย/เงินปันผล ที่นำมารวมคำนวณ (หักค่าใช้จ่ายไม่ได้)" before={calcBefore.netBySection.s4} after={calcAfter.netBySection.s4} />}
      {(calcBefore.exp5) > 0 && <ComparisonRow label="40(5) ค่าเช่า — ค่าใช้จ่ายที่หัก" before={calcBefore.exp5} after={calcAfter.exp5} />}
      {(calcBefore.netBySection.s5) > 0 && <ComparisonRow label="40(5) เงินได้หลังหักค่าใช้จ่าย" before={calcBefore.netBySection.s5} after={calcAfter.netBySection.s5} />}
      {(calcBefore.exp6) > 0 && <ComparisonRow label="40(6) วิชาชีพอิสระ — ค่าใช้จ่ายที่หัก" before={calcBefore.exp6} after={calcAfter.exp6} />}
      {(calcBefore.netBySection.s6) > 0 && <ComparisonRow label="40(6) เงินได้หลังหักค่าใช้จ่าย" before={calcBefore.netBySection.s6} after={calcAfter.netBySection.s6} />}
      {(calcBefore.exp78) > 0 && <ComparisonRow label="40(7)+(8) ธุรกิจ/รับเหมา/อื่นๆ — ค่าใช้จ่ายที่หัก" before={calcBefore.exp78} after={calcAfter.exp78} />}
      {(calcBefore.netBySection.s78) > 0 && <ComparisonRow label="40(7)+(8) เงินได้หลังหักค่าใช้จ่าย" before={calcBefore.netBySection.s78} after={calcAfter.netBySection.s78} />}
      <ComparisonRow label="รวมเงินได้หลังหักค่าใช้จ่ายทุกประเภท" before={calcBefore.incomeAfterExpense} after={calcAfter.incomeAfterExpense} bold />

      {(calcBefore.elderlyDisabledExemption > 0 || calcAfter.elderlyDisabledExemption > 0) && (
        <>
          <DetailHeading>เงินได้ที่ได้รับยกเว้นภาษี (ไม่ใช่ค่าลดหย่อน)</DetailHeading>
          <ComparisonRow label="ยกเว้นเงินได้ผู้สูงอายุ/ผู้พิการ (ตนเอง) 190,000 บาทแรก" before={calcBefore.elderlyDisabledExemption} after={calcAfter.elderlyDisabledExemption} sign="-" />
          <ComparisonRow label="เงินได้คงเหลือหลังหักส่วนที่ได้รับยกเว้น" before={calcBefore.incomeAfterExemption} after={calcAfter.incomeAfterExemption} bold />
        </>
      )}

      <DetailHeading>ค่าลดหย่อนที่นำมาใช้จริง</DetailHeading>
      <ComparisonRow label="ส่วนตัว" before={calcBefore.dPersonal} after={calcAfter.dPersonal} />
      {(calcBefore.dSpouse > 0 || calcAfter.dSpouse > 0) && <ComparisonRow label="คู่สมรส" before={calcBefore.dSpouse} after={calcAfter.dSpouse} />}
      {(calcBefore.dChildren > 0 || calcAfter.dChildren > 0) && <ComparisonRow label="บุตร" before={calcBefore.dChildren} after={calcAfter.dChildren} />}
      {(calcBefore.dParents > 0 || calcAfter.dParents > 0) && <ComparisonRow label="เลี้ยงดูบิดามารดา" before={calcBefore.dParents} after={calcAfter.dParents} />}
      {(calcBefore.dDisabled > 0 || calcAfter.dDisabled > 0) && <ComparisonRow label="ผู้พิการ/ทุพพลภาพ" before={calcBefore.dDisabled} after={calcAfter.dDisabled} />}
      {(calcBefore.dSocial > 0 || calcAfter.dSocial > 0) && <ComparisonRow label="ประกันสังคม" before={calcBefore.dSocial} after={calcAfter.dSocial} />}
      {(calcBefore.dLifeHealth > 0 || calcAfter.dLifeHealth > 0) && <ComparisonRowSplit label="ประกันชีวิต + ประกันสุขภาพตนเอง" before={calcBefore.dLifeHealth} after={calcAfter.dLifeHealth} />}
      {(calcBefore.dSpouseInsurance > 0 || calcAfter.dSpouseInsurance > 0) && <ComparisonRow label="ประกันชีวิตคู่สมรส (ไม่มีเงินได้)" before={calcBefore.dSpouseInsurance} after={calcAfter.dSpouseInsurance} />}
      {(calcBefore.dParentHealth > 0 || calcAfter.dParentHealth > 0) && <ComparisonRowSplit label="ประกันสุขภาพบิดามารดา" before={calcBefore.dParentHealth} after={calcAfter.dParentHealth} />}
      {(calcBefore.dAnnuityFinal > 0 || calcAfter.dAnnuityFinal > 0) && <ComparisonRowSplit label="ประกันชีวิตแบบบำนาญ" before={calcBefore.dAnnuityFinal} after={calcAfter.dAnnuityFinal} />}
      {(calcBefore.dPvdFinal > 0 || calcAfter.dPvdFinal > 0) && <ComparisonRowSplit label="กองทุนสำรองเลี้ยงชีพ/กบข." before={calcBefore.dPvdFinal} after={calcAfter.dPvdFinal} />}
      {(calcBefore.dRmfFinal > 0 || calcAfter.dRmfFinal > 0) && <ComparisonRowSplit label="RMF" before={calcBefore.dRmfFinal} after={calcAfter.dRmfFinal} />}
      {(calcBefore.dSsfFinal > 0 || calcAfter.dSsfFinal > 0) && <ComparisonRow label="SSF" before={calcBefore.dSsfFinal} after={calcAfter.dSsfFinal} />}
      {(calcBefore.dNsfFinal > 0 || calcAfter.dNsfFinal > 0) && <ComparisonRowSplit label="กอช." before={calcBefore.dNsfFinal} after={calcAfter.dNsfFinal} />}
      {(calcBefore.dTeacherFundFinal > 0 || calcAfter.dTeacherFundFinal > 0) && <ComparisonRowSplit label="กองทุนสงเคราะห์ครูโรงเรียนเอกชน" before={calcBefore.dTeacherFundFinal} after={calcAfter.dTeacherFundFinal} />}
      {(calcBefore.dTesg > 0 || calcAfter.dTesg > 0) && <ComparisonRowSplit label="Thai ESG Fund" before={calcBefore.dTesg} after={calcAfter.dTesg} />}
      {(calcBefore.dThaiesgx > 0 || calcAfter.dThaiesgx > 0) && <ComparisonRowSplit label="Thai ESGX" before={calcBefore.dThaiesgx} after={calcAfter.dThaiesgx} />}
      {(calcBefore.dHomeInterest > 0 || calcAfter.dHomeInterest > 0) && <ComparisonRow label="ดอกเบี้ยที่อยู่อาศัย" before={calcBefore.dHomeInterest} after={calcAfter.dHomeInterest} />}
      {(calcBefore.dDonation > 0 || calcAfter.dDonation > 0) && <ComparisonRow label="เงินบริจาค (ทั่วไป + 2 เท่า)" before={calcBefore.dDonation} after={calcAfter.dDonation} />}
      {(calcBefore.dPartyDonate > 0 || calcAfter.dPartyDonate > 0) && <ComparisonRow label="บริจาคพรรคการเมือง" before={calcBefore.dPartyDonate} after={calcAfter.dPartyDonate} />}
      {(calcBefore.dMaternity > 0 || calcAfter.dMaternity > 0) && <ComparisonRow label="ค่าฝากครรภ์/คลอดบุตร" before={calcBefore.dMaternity} after={calcAfter.dMaternity} />}
      {(calcBefore.dEasyReceipt > 0 || calcAfter.dEasyReceipt > 0) && <ComparisonRow label="มาตรการกระตุ้นเศรษฐกิจ" before={calcBefore.dEasyReceipt} after={calcAfter.dEasyReceipt} />}
      <ComparisonRow label="รวมค่าลดหย่อนทั้งหมด" before={calcBefore.totalDeductions} after={calcAfter.totalDeductions} bold />

      <DetailHeading>สรุปฐานภาษีและภาษีที่ต้องชำระ</DetailHeading>
      <ComparisonRow label={calcBefore.elderlyDisabledExemption > 0 ? "เงินได้หลังหักค่าใช้จ่าย/เงินได้ยกเว้น" : "เงินได้หลังหักค่าใช้จ่าย"} before={calcBefore.incomeAfterExemption} after={calcAfter.incomeAfterExemption} />
      <ComparisonRow label="หัก ค่าลดหย่อนรวม" before={calcBefore.totalDeductions} after={calcAfter.totalDeductions} sign="-" />
      <ComparisonRow label="เงินได้สุทธิ (ฐานภาษี)" before={calcBefore.netIncomeTaxable} after={calcAfter.netIncomeTaxable} bold />
      <ComparisonRow label="ภาษีคำนวณตามอัตราก้าวหน้า" before={calcBefore.taxProgressive} after={calcAfter.taxProgressive} />
      {(calcBefore.usedMinRule || calcAfter.usedMinRule) && <ComparisonRow label="ภาษีขั้นต่ำตามมาตรา 48(2) (0.5% ของเงินได้ (2)-(8))" before={calcBefore.taxMin} after={calcAfter.taxMin} />}
      {calcBefore.hasAnyCredit && (
        <>
          {(calcBefore.dividendCreditAmount) > 0 && <ComparisonRow label="หัก เครดิตภาษีเงินปันผล (ม.47 ทวิ)" before={calcBefore.dividendCreditAmount} after={calcAfter.dividendCreditAmount} sign="-" />}
          {(calcBefore.dividendWht) > 0 && <ComparisonRow label="หัก ภาษีเงินปันผลหัก ณ ที่จ่าย" before={calcBefore.dividendWht} after={calcAfter.dividendWht} sign="-" />}
          {(calcBefore.interestWhtCredit) > 0 && <ComparisonRow label="หัก ภาษีดอกเบี้ยหัก ณ ที่จ่ายที่ขอเครดิตคืน" before={calcBefore.interestWhtCredit} after={calcAfter.interestWhtCredit} sign="-" />}
        </>
      )}
      <div style={{ height: 2, background: "#0B3D78", margin: "10px 0" }} />
      <ComparisonFinalTaxRow calcBefore={calcBefore} calcAfter={calcAfter} />
      {calcBefore.withholdingPaid > 0 && (
        <>
          <ComparisonRow label="หัก ภาษีที่ถูกหักไว้แล้วระหว่างปี (WHT)" before={calcBefore.withholdingPaid} after={calcAfter.withholdingPaid} sign="-" />
          <div style={{ height: 2, background: "#0B3D78", margin: "10px 0" }} />
          <ComparisonRow
            label={calcBefore.isOverallRefund ? "ได้รับเงินคืนภาษี" : "ต้องชำระภาษีเพิ่ม"}
            before={Math.abs(calcBefore.netPayableAfterWithholding)}
            after={Math.abs(calcAfter.netPayableAfterWithholding)}
            bold
            colorAfter={calcAfter.netPayableAfterWithholding < calcBefore.netPayableAfterWithholding ? "#1B5E3A" : "#8A241C"}
          />
        </>
      )}
      {calcBefore.totalFinalTaxWithheld > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#9AA7BD", textAlign: "left", lineHeight: 1.7 }}>
          หมายเหตุ: มีภาษี Final Tax ที่ถูกหักไปแล้ว (ดอกเบี้ย/ปันผลที่เลือกไม่รวมคำนวณ) อีก {fmt(calcBefore.totalFinalTaxWithheld)} บาท (เท่ากันทั้งก่อน-หลัง เพราะไม่ขึ้นกับค่าลดหย่อน) ซึ่งจบไปแล้ว ไม่ต้องยื่นเพิ่ม —
          รวมภาระภาษีที่แท้จริงทั้งหมด ก่อนซื้อเพิ่ม {fmt(Math.abs(calcBefore.totalRealTaxBurden))} บาท / หลังซื้อเพิ่ม {fmt(Math.abs(calcAfter.totalRealTaxBurden))} บาท (เพื่อทราบไว้เฉยๆ)
        </div>
      )}
    </>
  );
}

// WhtField: ช่องกรอกภาษีหัก ณ ที่จ่ายเล็กๆ ต่อท้ายแต่ละประเภทเงินได้ (ถ้ามีถูกหักไว้) — ทำสไตล์ให้ดูรองจากช่องเงินได้หลัก
function WhtField({ value, onChange }) {
  return (
    <div style={{ marginTop: 10 }}>
      <label className="label-sm" style={{ fontSize: 13, color: "#6C93A8", marginBottom: 4 }}>ภาษีหัก ณ ที่จ่าย (ถ้ามี, บาท)</label>
      <NumField value={value} onChange={onChange} placeholder="0" />
    </div>
  );
}

function CapNote({ rule, cap, raw, used, hideRule }) {
  const excess = Math.max(0, raw - cap);
  const remaining = Math.max(0, cap - used);
  return (
    <>
      {!hideRule && rule && <div className="rule-text">{rule} — เพดานที่ใช้ได้จริงของคุณ: {fmt(cap)} บาท</div>}
      {excess > 0 && (
        <div className="excess-box">
          คุณกรอก {fmt(raw)} บาท เกินสิทธิ์ — นำมาลดหย่อนได้จริงเพียง {fmt(used)} บาท ส่วนเกิน {fmt(excess)} บาท ไม่สามารถใช้สิทธิ์ได้
        </div>
      )}
      {excess === 0 && raw > 0 && remaining > 0 && (
        <div className="remaining-box">ยังใช้สิทธิ์ไม่เต็ม สามารถเพิ่มได้อีก {fmt(remaining)} บาท (เต็มสิทธิ์ที่ {fmt(cap)} บาท)</div>
      )}
      {excess === 0 && raw > 0 && remaining === 0 && (
        <div className="full-box">ใช้สิทธิ์เต็มจำนวนแล้ว ({fmt(cap)} บาท)</div>
      )}
    </>
  );
}

/* RetireGroupBox: amber highlight distinguishing fields that share the pooled 500,000-baht retirement-group ceiling */
function RetireGroupBox({ calc, children }) {
  const remaining = Math.max(0, calc.groupMaxAchievable - calc.retirementGroupTotal);
  return (
    <div style={{ border: "2px solid #A9812F", background: "#FBF6E8", borderRadius: 6, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#7A5A0F", background: "#F0E2B8", borderRadius: 4, padding: "3px 9px" }}>
          กลุ่มเกษียณ — เพดานรวม 500,000 บาท
        </span>
        <span style={{ fontSize: 12.5, color: "#7A5A0F", fontWeight: 700 }}>
          ใช้ไปแล้ว {fmt(calc.retirementGroupTotal)} บาท · เหลือ {fmt(remaining)} บาท (ทุกกองรวมกัน)
        </span>
      </div>
      {children}
    </div>
  );
}

