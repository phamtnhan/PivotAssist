import path from "node:path";
import { prisma } from "../packages/db/dist/index.js";

try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env"));
} catch {
  // DATABASE_URL may already be set.
}

const jobs = [
  {
    id: "xint_52876",
    company: "Công ty TNHH Legacy Voyages Việt Nam",
    title: "Nhân viên Mua hàng",
    department: "Mua hàng",
    location: "Hà Nội",
    employmentType: "FULL_TIME",
    salaryRange: "13–15 triệu VND",
    sourceUrl: "https://x-interview.com/jobs/nhan-vien-mua-hang-52876",
    descriptionRaw: `Tìm kiếm nhà cung cấp, mua sắm vật tư và dịch vụ phục vụ vận hành du thuyền. Tiếp nhận yêu cầu mua hàng, so sánh báo giá, lập đơn, theo dõi giao nhận và thanh toán. Ưu tiên 2–3 năm kinh nghiệm mua hàng khách sạn/khu nghỉ dưỡng. Làm việc tại 60 Trương Công Giai, Cầu Giấy, Hà Nội.`,
  },
  {
    id: "xint_52875",
    company: "Công ty TNHH Legacy Voyages Việt Nam",
    title: "Chuyên viên Content",
    department: "Marketing",
    location: "Hà Nội",
    employmentType: "FULL_TIME",
    salaryRange: "13–15 triệu VND",
    sourceUrl: "https://x-interview.com/jobs/chuyen-vien-content-52875",
    descriptionRaw: `Xây dựng nội dung cho Facebook, Instagram, TikTok, LinkedIn, website, thư điện tử và landing. Viết bài quảng cáo, thông cáo, kịch bản video; phối hợp thiết kế và truyền thông. 2–3 năm kinh nghiệm Marketing/Truyền thông. Làm việc tại Cầu Giấy, Hà Nội.`,
  },
  {
    id: "xint_52874",
    company: "Job House",
    title: "Kỹ sư Quy trình cấp cao / Giám sát Quy trình",
    department: "Kỹ thuật sản xuất",
    location: "Đồng Nai",
    employmentType: "FULL_TIME",
    salaryRange: "25–32 triệu VND",
    sourceUrl: "https://x-interview.com/jobs/ky-su-quy-trinh-cap-cao-giam-sat-quy-trinh-52874",
    descriptionRaw: `Thiết kế và tối ưu quy trình lắp ráp, SOP, DFM/DFA, cân bằng chuyền, thẩm định Cp/Cpk, PFMEA và Control Plan. 3–5 năm kinh nghiệm NPI/quy trình điện tử. Làm việc tại KCN Long Đức, Đồng Nai. Có xe đưa đón từ TP. Hồ Chí Minh.`,
  },
  {
    id: "xint_52873",
    company: "Job House",
    title: "Nhân viên Kỹ sư Đồ gá điện",
    department: "Kỹ thuật",
    location: "Đồng Nai",
    employmentType: "FULL_TIME",
    salaryRange: "22 triệu VND",
    sourceUrl: "https://x-interview.com/jobs/nhan-vien-ky-su-do-ga-dien-52873",
    descriptionRaw: `Thiết kế, chế tạo và bảo trì đồ gá điện phục vụ kiểm tra ICT/FCT trên PCB. Đọc sơ đồ mạch, dùng đồng hồ vạn năng và máy hiện sóng. Từ 3 năm kinh nghiệm. KCN Long Đức, Đồng Nai.`,
  },
  {
    id: "xint_52872",
    company: "Công Ty TNHH Hải Vương",
    title: "Nhân viên HACCP",
    department: "Chất lượng",
    location: "Khánh Hòa",
    employmentType: "FULL_TIME",
    salaryRange: "9–12 triệu VND",
    sourceUrl: "https://x-interview.com/jobs/nhan-vien-haccp-52872",
    descriptionRaw: `Đăng ký kiểm hàng xuất khẩu, chuẩn bị hồ sơ cấp HC, theo dõi mẫu kiểm nghiệm tại NAFI và lưu trữ hồ sơ HACCP. Lô B KCN Suối Dầu, Cam Lâm, Khánh Hòa.`,
  },
  {
    id: "xint_52871",
    company: "Job House",
    title: "Nhân viên Kinh doanh doanh nghiệp",
    department: "Kinh doanh",
    location: "Hà Nội",
    employmentType: "FULL_TIME",
    salaryRange: "Khoảng 1.000 USD",
    sourceUrl: "https://x-interview.com/jobs/sales-b2b-52871",
    descriptionRaw: `Phụ trách bán hàng cho khách hàng doanh nghiệp, ưu tiên công ty Nhật. Chăm sóc khách hiện hữu, tìm khách mới, đề xuất hàng hóa, phối hợp nhập khẩu và làm việc với trụ sở Nhật. Ưu tiên tiếng Nhật N2. Làm việc tại Ba Đình, Hà Nội.`,
  },
  {
    id: "xint_52870",
    company: "Job House",
    title: "Chuyên viên kỹ thuật sản phẩm (EC)",
    department: "Kỹ thuật sản phẩm",
    location: "Hưng Yên",
    employmentType: "FULL_TIME",
    salaryRange: "20 triệu VND",
    sourceUrl: "https://x-interview.com/jobs/chuyen-vien-bo-phan-ky-thuat-san-pham-ec-52870",
    descriptionRaw: `Phát triển dự án từ thử nghiệm đến sản xuất hàng loạt. Làm Control Plan, FMEA, hướng dẫn thao tác, quản lý bản vẽ và thay đổi kỹ thuật, thiết kế đồ gá. Ít nhất 3 năm trong nhà máy điện tử/SMT. KCN Thăng Long II, Hưng Yên.`,
  },
  {
    id: "xint_52869",
    company: "Job House",
    title: "Kỹ thuật viên phân tích – sửa chữa (làm theo ca)",
    department: "Sản xuất",
    location: "Hưng Yên",
    employmentType: "FULL_TIME",
    salaryRange: "9–13 triệu VND",
    sourceUrl: "https://x-interview.com/jobs/ky-thuat-vien-phan-tich-sua-chua-di-lam-theo-ca-52869",
    descriptionRaw: `Phân tích và sửa sản phẩm lỗi trên chuyền và hàng trả về. Báo cáo lỗi cho cấp trên và khách hàng. Trung cấp điện/điện tử trở lên, ít nhất 1 năm sửa mạch PCBA. KCN Thăng Long II, Hưng Yên.`,
  },
  {
    id: "xint_52868",
    company: "Job House",
    title: "Trưởng phòng kế toán",
    department: "Kế toán",
    location: "Hưng Yên",
    employmentType: "FULL_TIME",
    salaryRange: "Lên tới 36 triệu VND",
    sourceUrl: "https://x-interview.com/jobs/truong-phong-ke-toan-52868",
    descriptionRaw: `Quản lý kế toán tổng hợp, công nợ, ngân hàng và khóa sổ. Báo cáo tài chính, ngân sách, tuân thủ chuẩn mực kế toán Việt Nam và thuế. Tối thiểu 4 năm ở vị trí tương đương. KCN Thăng Long II, Hưng Yên.`,
  },
  {
    id: "xint_52867",
    company: "Job House",
    title: "Trưởng phòng hành chính nhân sự",
    department: "Hành chính nhân sự",
    location: "Hưng Yên",
    employmentType: "FULL_TIME",
    salaryRange: "Lên tới 36 triệu VND",
    sourceUrl: "https://x-interview.com/jobs/truong-phong-hcns-52867",
    descriptionRaw: `Giám sát hành chính (nhà ăn, xe, bảo vệ, sự kiện) và nhân sự (lương, bảo hiểm, tuyển dụng, đào tạo). Am hiểu luật lao động. 3–5 năm kinh nghiệm HCNS, ưu tiên nhà máy. KCN Thăng Long II, Hưng Yên.`,
  },
];

async function main() {
  for (const job of jobs) {
    const company = await prisma.company.upsert({
      where: { name: job.company },
      create: { name: job.company, verificationStatus: "VERIFIED", websiteUrl: job.sourceUrl },
      update: { verificationStatus: "VERIFIED" },
    });
    const existing = await prisma.job.findFirst({ where: { OR: [{ id: job.id }, { sourceUrl: job.sourceUrl }] }, select: { id: true } });
    const data = {
      companyId: company.id,
      title: job.title,
      department: job.department,
      location: job.location,
      employmentType: job.employmentType,
      salaryRange: job.salaryRange,
      sourceUrl: job.sourceUrl,
      descriptionRaw: job.descriptionRaw,
      isPublished: true,
      hiringCount: 1,
      archivedAt: null,
    };
    if (existing) {
      await prisma.job.update({ where: { id: existing.id }, data });
      console.log("updated", job.title);
    } else {
      await prisma.job.create({ data: { id: job.id, ...data } });
      console.log("created", job.title);
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
