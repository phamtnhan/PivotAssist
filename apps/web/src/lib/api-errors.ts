export type ApiLocale = "vi" | "en";

const VI_CHAR =
  /[ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/;

const EN_BY_VI: Record<string, string> = {
  "Địa chỉ email không hợp lệ": "That email address is not valid.",
  "Vui lòng nhập mật khẩu": "Please enter your password.",
  "Họ và tên phải có tối thiểu 2 ký tự": "Name must be at least 2 characters.",
  "Mật khẩu phải có ít nhất 6 ký tự": "Password must be at least 6 characters.",
  "Dữ liệu đăng ký không hợp lệ": "Registration details are not valid.",
  "Thông tin đăng nhập không hợp lệ": "Sign-in details are not valid.",
  "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.": "Email or password is incorrect.",
  "Tài khoản đang bị tạm khóa. Vui lòng liên hệ hỗ trợ.":
    "This account is locked. Contact support.",
  "Tài khoản đang bị tạm khóa. Vui lòng liên hệ admin.": "This account is locked. Contact support.",
  "Nhập mã xác thực 6 số từ Google Authenticator hoặc ứng dụng TOTP.":
    "Enter the 6-digit code from your authenticator app.",
  "Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại sau.":
    "Sign-in failed. Please try again.",
  "Không thể kết nối cơ sở dữ liệu MySQL. Vui lòng kiểm tra dịch vụ MySQL và DATABASE_URL trong .env":
    "Could not reach the database. Try again in a moment.",
  "Email không hợp lệ.": "That email address is not valid.",
  "Địa chỉ email này đã được sử dụng. Vui lòng đăng nhập hoặc chọn email khác.":
    "This email is already in use. Sign in or use another email.",
  "Đã xảy ra lỗi khi tạo tài khoản. Vui lòng thử lại sau.":
    "Could not create the account. Please try again.",
  "Bạn cần đăng nhập để bắt đầu phiên luyện tập.": "Please sign in to start a practice session.",
  "Chỉ tài khoản ứng viên mới có thể tạo phiên luyện tập.":
    "Only an applicant account can start a practice session.",
  "Không thể tạo phiên luyện tập.": "Could not create the practice session.",
  "Bạn cần đăng nhập để tương tác với phỏng vấn AI.":
    "Please sign in to continue the AI interview.",
  "Nội dung câu trả lời không hợp lệ.": "The answer is not valid.",
  "Phiên phỏng vấn không tồn tại.": "The interview session does not exist.",
  "Phiên phỏng vấn đã kết thúc.": "This interview session has already ended.",
  "Không thể xử lý lượt trả lời phỏng vấn.": "Could not process that answer.",
  "Bạn cần đăng nhập để bắt đầu phỏng vấn AI.": "Please sign in to start the AI interview.",
  "Hồ sơ không tồn tại.": "This application does not exist.",
  "Bạn không có quyền truy cập hồ sơ này.": "You do not have access to this application.",
  "Hồ sơ chưa có CV. Hãy tải CV trước khi bắt đầu phỏng vấn.":
    "Upload a CV before starting the interview.",
  "Hồ sơ chưa có CV.": "This application has no CV yet.",
  "Không thể khởi tạo phỏng vấn AI cho hồ sơ này.":
    "Could not start the AI interview for this application.",
  "Không thể tải danh sách việc làm.": "Could not load open roles.",
  "Bạn cần đăng nhập để xem hồ sơ đã nộp.": "Please sign in to view submitted applications.",
  "Không thể tải danh sách hồ sơ đã nộp.": "Could not load submitted applications.",
  "Bạn cần đăng nhập để nộp hồ sơ.": "Please sign in to apply.",
  "Chỉ tài khoản ứng viên mới có thể nộp hồ sơ.": "Only an applicant account can apply.",
  "Việc làm không tồn tại hoặc đã đóng.": "This role is closed or no longer available.",
  "Việc làm này không còn hiển thị công khai.": "This role is no longer public.",
  "Bạn cần tải CV trước khi nộp hồ sơ.": "Upload a CV before you apply.",
  "Không thể nộp hồ sơ. Vui lòng thử lại.": "Could not submit the application. Please try again.",
  "Bạn cần đăng nhập bằng tài khoản doanh nghiệp.": "Please sign in with an employer account.",
  "Không thể tải danh sách tin tuyển dụng.": "Could not load job listings.",
  "Không thể tạo tin tuyển dụng.": "Could not create the listing.",
  "Tổng trọng số rubric phải bằng 100%.": "Scoring weights must add up to 100%.",
  "Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.":
    "This application does not exist or you do not have access.",
  "Không thể tải hồ sơ ứng viên.": "Could not load the application.",
  "Không thể cập nhật trạng thái hồ sơ.": "Could not update the application.",
  "Chỉ hồ sơ đã hoàn tất phỏng vấn AI và có điểm đánh giá mới được chọn sơ loại.":
    "Select for the next round only after the AI interview has a score.",
  "Bạn cần đăng nhập để chat hỗ trợ.": "Please sign in to use support chat.",
  "Không gửi được tin nhắn.": "Could not send the message.",
  "Nội dung chat không hợp lệ.": "That message is not valid.",
  "Bạn cần đăng nhập để hoàn tất phỏng vấn AI.": "Please sign in to finish the AI interview.",
  "Không thể hoàn tất và chấm điểm phỏng vấn AI.": "Could not finish and score the AI interview.",
  "Bạn cần đăng nhập để xem đánh giá buổi phỏng vấn AI.":
    "Please sign in to view the interview review.",
  "Không thể tải đánh giá buổi phỏng vấn AI.": "Could not load the interview review.",
  "Chưa có không gian doanh nghiệp.": "No employer space yet.",
  "Không thể tải không gian doanh nghiệp.": "Could not load the employer space.",
  "Không thể cập nhật thông tin công ty.": "Could not update company details.",
  "Tên doanh nghiệp hoặc mã số thuế đã được sử dụng.":
    "That company name or tax ID is already in use.",
  "Cấu hình buổi luyện không hợp lệ.": "Interview settings are not valid.",
  "Bạn cần đăng nhập bằng tài khoản doanh nghiệp để tạo tin tuyển dụng.":
    "Sign in with an employer account to create a listing.",
  "Dữ liệu tin tuyển dụng không hợp lệ.": "Listing details are not valid.",
  "Tên doanh nghiệp không hợp lệ. Dùng tên công ty thật (không phải chuỗi test như 12dâfaf).":
    "Use a real company name, not a test string.",
  "Tên doanh nghiệp đã được sử dụng. Vui lòng chọn tên khác.":
    "That company name is already in use.",
  "Trạng thái hồ sơ không hợp lệ.": "That application status is not valid.",
  "Dữ liệu hồ sơ không hợp lệ.": "Application details are not valid.",
  "CV không thuộc tài khoản hiện tại.": "That CV does not belong to this account.",
  "Job là bắt buộc": "A job listing is required.",
  "Role demo không hợp lệ.": "That demo role is not valid.",
  "Không thể tạo phiên demo.": "Could not start the demo session.",
  "Nếu email tồn tại, hướng dẫn khôi phục sẽ được gửi.":
    "If that email exists, reset instructions will be sent.",
  "Lỗi kiểm tra trạng thái xác thực": "Could not check the sign-in state.",
  "Không thể tải số liệu doanh nghiệp.": "Could not load employer analytics.",
  "Bạn cần đăng nhập để nghe giọng đọc.": "Please sign in to hear the interviewer voice.",
  "Thiếu nội dung cần đọc.": "Nothing to read aloud.",
  "Bạn cần đăng nhập để viết lại CV.": "Please sign in to rewrite the CV.",
  "Không thể viết lại mục trong CV.": "Could not rewrite that CV line.",
  "Tin tuyển dụng không tồn tại hoặc đã đóng.": "This listing is closed or no longer available.",
  "Bạn cần đăng nhập để xem điểm khớp.": "Please sign in to see the match score.",
  "Bạn cần tải CV trước khi tính điểm khớp.": "Upload a CV before calculating the match score.",
  "Không thể tính điểm khớp.": "Could not calculate the match score.",
  "Bạn cần đăng nhập để tính điểm khớp.": "Please sign in to calculate the match score.",
  "Dữ liệu điểm khớp không hợp lệ.": "Match details are not valid.",
  "Tin tuyển dụng không tồn tại hoặc bạn không có quyền truy cập.":
    "This listing does not exist or you do not have access.",
  "Không thể tải bảng xếp hạng của tin.": "Could not load the listing ranking.",
  "Chỉ chủ sở hữu hoặc quản trị mới được thêm thành viên.":
    "Only an owner or admin can add members.",
  "Chỉ quản trị viên mới xem được nhật ký phỏng vấn.": "Only an admin can view interview records.",
  "Không thể tải nhật ký phỏng vấn.": "Could not load interview records.",
  "Bạn cần đăng nhập để xem câu hỏi phỏng vấn.": "Please sign in to view interview questions.",
  "Phiên phỏng vấn đã kết thúc hoặc đang được chấm.":
    "This interview has ended or is being scored.",
  "Không thể tải câu hỏi phỏng vấn.": "Could not load interview questions.",
  "Chỉ chủ sở hữu hoặc quản trị công ty mới được sửa thông tin.":
    "Only the owner or an admin can edit company details.",
  "Không thể tải danh sách hồ sơ doanh nghiệp.": "Could not load employer applications.",
  "Bạn cần đăng nhập để cập nhật hồ sơ đã nộp.": "Please sign in to update the application.",
  "Hồ sơ đã đóng và không thể rút lại.": "This application is closed and cannot be withdrawn.",
  "Không thể rút hồ sơ đã nộp.": "Could not withdraw the application.",
  "Không thể tải hồ sơ đã nộp.": "Could not load the application.",
  "Không thể tải ghi chú hồ sơ.": "Could not load notes.",
  "Không thể lưu ghi chú hồ sơ.": "Could not save the note.",
  "Ghi chú không tồn tại hoặc bạn không có quyền xóa.":
    "That note does not exist or you cannot delete it.",
  "Không thể xóa ghi chú hồ sơ.": "Could not delete the note.",
  "Tính năng viết lại CV chỉ dành cho ứng viên.": "Rewriting a CV is only for applicant accounts.",
  "Bullet CV không hợp lệ.": "That CV line is not valid.",
  "Điểm khớp chỉ dành cho ứng viên.": "Match scores are only for applicant accounts.",
  "Email này đã được sử dụng. Đăng nhập đúng mật khẩu để nâng cấp không gian doanh nghiệp.":
    "This email is already in use. Sign in with the correct password to upgrade the employer space.",
  "Không thể tạo không gian doanh nghiệp.": "Could not create the employer space.",
  "Bạn cần đăng nhập để vào phòng phỏng vấn.": "Please sign in to join the interview room.",
  "Bạn không có quyền vào phòng này.": "You do not have access to this room.",
  "Không thể cấp LiveKit token.": "Could not issue a room token.",
  "Không thể tải tin tuyển dụng.": "Could not load the listing.",
  "Không thể cập nhật tin tuyển dụng.": "Could not update the listing.",
  "Không thể lưu trữ tin tuyển dụng.": "Could not archive the listing.",
  "Thành viên không tồn tại.": "That member does not exist.",
  "Bạn không có quyền xóa thành viên.": "You cannot remove this member.",
  "Không thể xóa chủ sở hữu cuối cùng của công ty.": "The last company owner cannot be removed.",
  "Không thể xóa thành viên công ty.": "Could not remove the company member.",
  "Không thể thêm thành viên công ty.": "Could not add the company member.",
  "Không thể mở CV.": "Could not open the CV.",
  "Phiên phỏng vấn AI không tồn tại hoặc bạn không có quyền truy cập.":
    "This AI interview does not exist or you do not have access.",
  "Không thể tải lịch phòng phỏng vấn.": "Could not load interview room times.",
  "Hồ sơ phải được chọn sơ loại trước khi đặt lịch.":
    "Select the applicant for the next round before booking a time.",
  "Không thể tạo phòng phỏng vấn.": "Could not create the interview room.",
  "Thông tin lịch không hợp lệ.": "The schedule details are not valid.",
  "Lịch không tồn tại.": "That schedule does not exist.",
  "Không thể cập nhật lịch phòng phỏng vấn.": "Could not update the interview room time.",
  "Chỉ ứng viên mới có thể hoàn tất phiên phỏng vấn.":
    "Only an applicant can finish this interview.",
  "Thời lượng phiên không hợp lệ.": "The session length is not valid.",
  "Phiên phỏng vấn AI không tồn tại.": "The AI interview session does not exist.",
  "Gemini đã cấu hình nhưng trả JSON không khớp schema. Không fallback heuristic.":
    "The scoring service returned an unexpected result. Try again.",
  "Không thể phân tích tin tuyển dụng.": "Could not analyze the listing.",
  "Chỉ quản trị viên mới xem được hộp thư hỗ trợ.": "Only an admin can view the support inbox.",
  "Chỉ quản trị viên mới cập nhật được hộp thư hỗ trợ.":
    "Only an admin can update the support inbox.",
  "Dữ liệu cập nhật không hợp lệ.": "The update is not valid.",
  "Bạn cần đăng nhập để phân tích tin tuyển dụng.": "Please sign in to analyze a listing.",
  "Vui lòng chọn tệp tin tuyển dụng.": "Please choose a listing file.",
  "Tệp tin tuyển dụng không được vượt quá 10MB.": "The listing file must be 10MB or smaller.",
  "Không đọc được nội dung tin tuyển dụng. Hãy dùng PDF có chữ, Markdown hoặc TXT.":
    "Could not read the listing. Use a text PDF, Markdown, or TXT.",
  "Không thể phân tích tệp tin tuyển dụng.": "Could not analyze the listing file.",
  "Bạn cần đăng nhập để gửi yêu cầu hỗ trợ.": "Please sign in to send a support request.",
  "Nội dung yêu cầu không hợp lệ.": "That request is not valid.",
  "Không gửi được yêu cầu hỗ trợ.": "Could not send the support request.",
  "Bạn cần đăng nhập để xem yêu cầu hỗ trợ.": "Please sign in to view support requests.",
  "Bạn cần đăng nhập để lấy token phòng họp.": "Please sign in to join the meeting.",
  "Phòng phỏng vấn không tồn tại hoặc bạn không có quyền.":
    "This interview room does not exist or you do not have access.",
  "Lịch này đã hủy.": "This booking has been cancelled.",
  "Không thể cấp quyền vào phòng phỏng vấn.": "Could not grant access to the interview room.",
  "Không thể tải phòng phỏng vấn.": "Could not load the interview room.",
  "Bạn cần đăng nhập để xem phòng phỏng vấn.": "Please sign in to view interview rooms.",
  "Không thể tải danh sách phòng phỏng vấn.": "Could not load interview rooms.",
  "Bạn cần đăng nhập để xem CV.": "Please sign in to view the CV.",
  "Chỉ tài khoản ứng viên mới có CV cá nhân.": "Only an applicant account has a personal CV.",
  "Không thể tải danh sách CV.": "Could not load CVs.",
  "Bạn cần đăng nhập để tải CV.": "Please sign in to upload a CV.",
  "Chỉ tài khoản ứng viên mới có thể tải CV.": "Only an applicant account can upload a CV.",
  "Vui lòng chọn file CV.": "Please choose a CV file.",
  "CV không được vượt quá 15MB.": "The CV must be 15MB or smaller.",
  "Không thể lưu CV. Vui lòng thử lại.": "Could not save the CV. Please try again.",
  "Bạn cần đăng nhập để chọn gói dịch vụ.": "Please sign in to choose a plan.",
  "Gói dịch vụ không hợp lệ.": "That plan is not valid.",
  "MoMo chưa cấu hình. Thiếu MOMO_PARTNER_CODE / MOMO_ACCESS_KEY / MOMO_SECRET_KEY.":
    "MoMo is not configured yet.",
  "Mã xác thực không hợp lệ.": "That verification code is not valid.",
  "Phiên xác thực 2FA đã hết hạn. Hãy đăng nhập lại.":
    "The verification session expired. Sign in again.",
  "Tài khoản không còn hiệu lực.": "This account is no longer active.",
  "Tài khoản chưa bật TOTP.": "Two-step verification is not enabled on this account.",
  "Mã TOTP không đúng hoặc đã hết hạn.": "That code is incorrect or has expired.",
  "Bạn cần đăng nhập để xem hồ sơ.": "Please sign in to view the profile.",
  "Tài khoản không tồn tại.": "That account does not exist.",
  "Không thể tải hồ sơ.": "Could not load the profile.",
  "Bạn cần đăng nhập để cập nhật hồ sơ.": "Please sign in to update the profile.",
  "Không thể cập nhật hồ sơ.": "Could not update the profile.",
  "Bạn cần đăng nhập để nhận cập nhật tức thì.": "Please sign in to receive live updates.",
  "Bạn cần đăng nhập để bắt đầu phiên phỏng vấn.": "Please sign in to start the interview.",
  "Không thể bắt đầu phiên phỏng vấn.": "Could not start the interview.",
  "2FA chưa được bật.": "Two-step verification is not enabled.",
  "2FA đã được bật. Hãy tắt trước khi enroll lại.":
    "Two-step verification is already on. Turn it off before setting it up again.",
  "Bạn cần đăng nhập để bật 2FA.": "Please sign in to turn on two-step verification.",
  "Bạn cần đăng nhập để cập nhật CV.": "Please sign in to update the CV.",
  "Bạn cần đăng nhập để cập nhật thông báo.": "Please sign in to update notifications.",
  "Bạn cần đăng nhập để cập nhật ảnh đại diện.": "Please sign in to update the photo.",
  "Bạn cần đăng nhập để ghi transcript.": "Please sign in to save the spoken record.",
  "Bạn cần đăng nhập để ghi visual event.": "Please sign in to save that event.",
  "Bạn cần đăng nhập để thêm skill.": "Please sign in to add a skill.",
  "Bạn cần đăng nhập để tải hóa đơn.": "Please sign in to download the invoice.",
  "Bạn cần đăng nhập để tắt 2FA.": "Please sign in to turn off two-step verification.",
  "Bạn cần đăng nhập để xem hóa đơn.": "Please sign in to view invoices.",
  "Bạn cần đăng nhập để xem skill assessment.": "Please sign in to view the skill review.",
  "Bạn cần đăng nhập để xem skills.": "Please sign in to view skills.",
  "Bạn cần đăng nhập để xem thông báo.": "Please sign in to view notifications.",
  "Bạn cần đăng nhập để xem transcript.": "Please sign in to view the spoken record.",
  "Bạn cần đăng nhập để xem visual event.": "Please sign in to view that event.",
  "Bạn cần đăng nhập để xem ảnh đại diện.": "Please sign in to view the photo.",
  "Bạn cần đăng nhập để xác nhận 2FA.": "Please sign in to confirm two-step verification.",
  "Bạn cần đăng nhập để xóa CV.": "Please sign in to delete the CV.",
  "Bạn cần đăng nhập để xóa skill.": "Please sign in to remove the skill.",
  "Bạn cần đăng nhập để xóa tài khoản.": "Please sign in to delete the account.",
  "Bạn cần đăng nhập để đổi mật khẩu.": "Please sign in to change the password.",
  "Bạn cần đăng nhập.": "Please sign in.",
  "Bạn không có quyền cập nhật CV.": "You cannot update this CV.",
  "Bạn không có quyền xóa CV.": "You cannot delete this CV.",
  "CV không tồn tại.": "That CV does not exist.",
  "Chưa có enrollment TOTP. Hãy bắt đầu bước thiết lập trước.": "Start two-step setup first.",
  "Chưa có hóa đơn để tải.": "There is no invoice to download yet.",
  "Chưa có thay đổi hợp lệ.": "No valid change was sent.",
  "Chỉ admin mới có quyền cập nhật doanh nghiệp.": "Only an admin can update companies.",
  "Chỉ admin mới có quyền cập nhật người dùng.": "Only an admin can update users.",
  "Chỉ admin mới có quyền xem audit log.": "Only an admin can view system records.",
  "Chỉ admin mới có quyền xem doanh nghiệp.": "Only an admin can view companies.",
  "Chỉ admin mới có quyền xem người dùng.": "Only an admin can view users.",
  "Chỉ admin mới có quyền xem tổng quan hệ thống.": "Only an admin can view the system overview.",
  "Chỉ admin mới xem được thanh toán.": "Only an admin can view payments.",
  "Chỉ admin mới xác nhận thanh toán.": "Only an admin can confirm payments.",
  "Chỉ chấp nhận JPEG, PNG, WebP hoặc GIF.": "Only JPEG, PNG, WebP, or GIF files are accepted.",
  "Chữ ký MoMo không hợp lệ.": "The MoMo signature is not valid.",
  "Cần mật khẩu và mã TOTP để tắt 2FA.":
    "A password and authenticator code are required to turn this off.",
  "Dữ liệu cập nhật CV không hợp lệ.": "The CV update is not valid.",
  "Dữ liệu cập nhật người dùng không hợp lệ.": "The user update is not valid.",
  "Dữ liệu doanh nghiệp không hợp lệ.": "The company details are not valid.",
  "Dữ liệu thông báo không hợp lệ.": "The notification details are not valid.",
  "Hóa đơn không còn hiệu lực.": "This invoice is no longer valid.",
  "IPN MoMo không hợp lệ.": "The MoMo payment notice is not valid.",
  "Không có quyền truy cập ảnh này.": "You do not have access to this photo.",
  "Không thể cập nhật CV.": "Could not update the CV.",
  "Không thể cập nhật doanh nghiệp.": "Could not update the company.",
  "Không thể cập nhật hóa đơn.": "Could not update the invoice.",
  "Không thể cập nhật mật khẩu.": "Could not update the password.",
  "Không thể cập nhật người dùng.": "Could not update the user.",
  "Không thể cập nhật thông báo.": "Could not update notifications.",
  "Không thể ghi transcript sau khi phiên đã kết thúc.":
    "The spoken record cannot be saved after the session ends.",
  "Không thể ghi visual event sau khi phiên đã kết thúc.":
    "That event cannot be saved after the session ends.",
  "Không thể hủy hóa đơn đã thanh toán.": "A paid invoice cannot be cancelled.",
  "Không thể lưu skill.": "Could not save the skill.",
  "Không thể lưu transcript.": "Could not save the spoken record.",
  "Không thể lưu visual event.": "Could not save that event.",
  "Không thể lưu ảnh đại diện.": "Could not save the photo.",
  "Không thể tạo skill assessment.": "Could not create the skill review.",
  "Không thể tải CV.": "Could not load the CV.",
  "Không thể tải audit log.": "Could not load system records.",
  "Không thể tải danh sách doanh nghiệp.": "Could not load companies.",
  "Không thể tải danh sách người dùng.": "Could not load users.",
  "Không thể tải file CV.": "Could not load the CV file.",
  "Không thể tải hóa đơn.": "Could not load invoices.",
  "Không thể tải skills.": "Could not load skills.",
  "Không thể tải thông báo.": "Could not load notifications.",
  "Không thể tải transcript.": "Could not load the spoken record.",
  "Không thể tải tổng quan admin.": "Could not load the admin overview.",
  "Không thể tải visual event.": "Could not load that event.",
  "Không thể tự khóa tài khoản admin hiện tại.": "You cannot lock your own admin account.",
  "Không thể xác nhận thanh toán.": "Could not confirm the payment.",
  "Không thể xóa CV.": "Could not delete the CV.",
  "Không thể xóa skill.": "Could not remove the skill.",
  "Không thể xóa tài khoản.": "Could not delete the account.",
  "Không thể xử lý IPN MoMo.": "Could not process the MoMo payment notice.",
  "Không tìm thấy hóa đơn MoMo.": "The MoMo invoice was not found.",
  "Không tìm thấy hóa đơn.": "The invoice was not found.",
  "Không tìm thấy ảnh đại diện.": "The photo was not found.",
  "MoMo chưa cấu hình. Không chấp nhận IPN.":
    "MoMo is not configured. Payment notices are not accepted.",
  "Mã TOTP không hợp lệ.": "That authenticator code is not valid.",
  "Mã TOTP không đúng.": "That authenticator code is incorrect.",
  "Mã TOTP không đúng. Thử mã hiện tại trên ứng dụng authenticator.":
    "That code is incorrect. Try the current code in your authenticator app.",
  "Mật khẩu hiện tại không đúng.": "The current password is incorrect.",
  "Mật khẩu không đúng.": "The password is incorrect.",
  "Mật khẩu mới chưa hợp lệ.": "The new password is not valid.",
  "Skill không tồn tại.": "That skill does not exist.",
  "Số tiền IPN không khớp hóa đơn.": "The payment amount does not match the invoice.",
  "Thiếu mã hóa đơn.": "The invoice code is missing.",
  "Transcript không hợp lệ.": "The spoken record is not valid.",
  "Visual event không hợp lệ.": "That event is not valid.",
  "Vui lòng chọn ảnh đại diện.": "Please choose a photo.",
  "Yêu cầu xác nhận không hợp lệ.": "The confirmation request is not valid.",
  "partnerCode không khớp cấu hình.": "The payment partner code does not match.",
  "Ảnh đại diện không được vượt quá 3MB.": "The photo must be 3MB or smaller.",
  "Chỉ quản trị viên mới xem được thanh toán.": "Only an admin can view payments.",
  "Chỉ quản trị viên mới xác nhận thanh toán.": "Only an admin can confirm payments.",
  "Xác thực hai bước chưa được bật.": "Two-step verification is not enabled.",
  "Xác thực hai bước đã được bật. Hãy tắt trước khi thiết lập lại.":
    "Two-step verification is already on. Turn it off before setting it up again.",
  "Bạn cần đăng nhập để xóa kỹ năng.": "Please sign in to remove the skill.",
  "Kỹ năng không tồn tại.": "That skill does not exist.",
  "Không thể xóa kỹ năng.": "Could not remove the skill.",
  "Bạn cần đăng nhập để xem kỹ năng.": "Please sign in to view skills.",
  "Không thể tải kỹ năng.": "Could not load skills.",
  "Bạn cần đăng nhập để thêm kỹ năng.": "Please sign in to add a skill.",
  "Không thể lưu kỹ năng.": "Could not save the skill.",
  "Bạn cần đăng nhập để xem đánh giá kỹ năng.": "Please sign in to view the skill review.",
  "Không thể tạo đánh giá kỹ năng.": "Could not create the skill review.",
  "Chỉ quản trị viên mới xem được người dùng.": "Only an admin can view users.",
  "Chỉ quản trị viên mới cập nhật được người dùng.": "Only an admin can update users.",
  "Không thể tự khóa tài khoản quản trị hiện tại.": "You cannot lock your own admin account.",
  "Chỉ quản trị viên mới xem được nhật ký hệ thống.": "Only an admin can view system records.",
  "Không thể tải nhật ký hệ thống.": "Could not load system records.",
  "Chỉ quản trị viên mới xem được doanh nghiệp.": "Only an admin can view companies.",
  "Chỉ quản trị viên mới cập nhật được doanh nghiệp.": "Only an admin can update companies.",
  "Chỉ quản trị viên mới xem được tổng quan hệ thống.":
    "Only an admin can view the system overview.",
  "Không thể tải tổng quan hệ thống.": "Could not load the system overview.",
  "Bạn cần đăng nhập để bật xác thực hai bước.": "Please sign in to turn on two-step verification.",
  "Bạn cần đăng nhập để tắt xác thực hai bước.":
    "Please sign in to turn off two-step verification.",
  "Cần mật khẩu và mã xác thực để tắt xác thực hai bước.":
    "A password and authenticator code are required to turn this off.",
  "Phiên xác thực hai bước đã hết hạn. Hãy đăng nhập lại.":
    "The verification session expired. Sign in again.",
  "Bạn cần đăng nhập để xác nhận xác thực hai bước.":
    "Please sign in to confirm two-step verification.",
  "Chưa bắt đầu bước thiết lập. Hãy thiết lập xác thực hai bước trước.":
    "Start two-step setup first.",
};

export function requestLocale(request?: Request | null): ApiLocale {
  const cookie = request?.headers.get("cookie") ?? "";
  return /(?:^|;\s*)pivotassist-locale=en(?:;|$)/.test(cookie) ? "en" : "vi";
}

export function englishForApiError(message?: string | null): string | undefined {
  if (!message) return undefined;
  if (EN_BY_VI[message]) return EN_BY_VI[message];
  const quota = message.match(/đã đạt hạn mức (\d+) tin đang tuyển/);
  if (quota) return `This employer space has reached the limit of ${quota[1]} open listings.`;
  return undefined;
}

export function isVietnameseText(value?: string | null): boolean {
  return Boolean(value && VI_CHAR.test(value));
}

export function apiErrorText(
  payload: { error?: string; errorEn?: string; code?: string } | null | undefined,
  locale: ApiLocale,
  fallback: string,
): string {
  if (locale === "en") {
    if (payload?.errorEn) return payload.errorEn;
    const mapped = englishForApiError(payload?.error);
    if (mapped) return mapped;
    if (isVietnameseText(payload?.error)) return fallback;
  }
  return payload?.error || fallback;
}

export function localizeApiError(message: string, locale: ApiLocale): string {
  if (locale !== "en") return message;
  return englishForApiError(message) ?? message;
}
