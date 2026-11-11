package com.cinema.booking.service.impl;

import com.cinema.booking.dto.request.ChatRequest;
import com.cinema.booking.dto.response.ChatResponse;
import com.cinema.booking.entity.Movie;
import com.cinema.booking.entity.Product;
import com.cinema.booking.entity.Showtime;
import com.cinema.booking.enums.MovieStatus;
import com.cinema.booking.repository.MovieRepository;
import com.cinema.booking.repository.ProductRepository;
import com.cinema.booking.repository.ShowtimeRepository;
import com.cinema.booking.service.ChatService;
import com.cinema.booking.service.GeminiClientService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatServiceImpl implements ChatService {

    private final MovieRepository movieRepository;
    private final ShowtimeRepository showtimeRepository;
    private final ProductRepository productRepository;
    private final GeminiClientService geminiClientService;

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");

    @Override
    @Transactional(readOnly = true)
    public ChatResponse askChatbot(ChatRequest request) {
        log.debug("CineBot request: historyMessages={}",
                request.getConversationHistory() == null ? 0 : request.getConversationHistory().size());

        // 1. Thu thap du lieu thuc te tu Database (Context Injection / RAG co ban)
        String systemPrompt = buildSystemPromptWithContext();

        // 2. Chuan bi danh sach hoi thoai cho Gemini API
        List<Map<String, Object>> contents = new ArrayList<>();

        if (request.getConversationHistory() != null && !request.getConversationHistory().isEmpty()) {
            for (ChatRequest.ChatMessage msg : request.getConversationHistory()) {
                String role = "model".equalsIgnoreCase(msg.getRole()) ? "model" : "user";
                contents.add(Map.of(
                        "role", role,
                        "parts", List.of(Map.of("text", msg.getText()))
                ));
            }
        }

        // Them tin nhan hien tai cua user
        contents.add(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", request.getMessage()))
        ));

        // 3. Goi GeminiClientService
        String reply = geminiClientService.generateContent(systemPrompt, contents);

        return ChatResponse.builder()
                .reply(reply)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * Xay dung System Prompt bao gom du lieu thoi gian thuc cua he thong.
     */
    private String buildSystemPromptWithContext() {
        StringBuilder context = new StringBuilder();

        context.append("Ban la 'CineBot' - Tro ly ao thong minh cua he thong rap chieu phim Cinema Booking.\n");
        context.append("Nhiem vu cua ban la tu van phim, lich chieu, gia ve, bap nuoc va huong dan nguoi dung dat ve.\n\n");
        context.append("=== NGUYEN TAC QUAN TRONG (BAT BUOC TUAN THU) ===\n");
        context.append("1. Luon giao tiep bang tieng Viet lich su, than thien, chuyen nghiep va tu nhien.\n");
        context.append("2. CHI TU VAN dua tren danh sach phim, suat chieu va bap nuoc co trong du lieu he thong duoi day.\n");
        context.append("3. TUYET DOI KHONG TU BIA DAT (anti-hallucination) thong tin ve phim, gio chieu hoac rap neu khong xuat hien trong du lieu.\n");
        context.append("4. Neu nguoi dung hoi ve mot bo phim hoac dich vu khong co trong du lieu, hay lich su tra loi rang rap hien tai chua co hoac chua co lich chieu cho bo phim do.\n");
        context.append("5. Neu he thong hien tai chua co du lieu phim hoac lich chieu, hay thong bao lich su voi nguoi dung la rap dang cap nhat lich chieu moi.\n");
        context.append("6. Khi goi y phim hoac suat chieu, hay neu ro ten rap, phong chieu, gio chieu va huong dan nguoi dung chon ghe tren website de dat ve.\n");
        context.append("7. Gia trong lich chieu la gia co ban, khong phai gia chinh xac cua ghe VIP hoac COUPLE. Khong tu tinh phu thu; huong dan chon suat va ghe de xem gia thuc te.\n\n");

        context.append("=== DU LIEU THOI GIAN THUC CUA HE THONG ===\n");
        context.append("Thoi gian hien tai: ").append(LocalDateTime.now().format(DATE_TIME_FORMATTER)).append("\n\n");

        // 1. Phim dang chieu & sap chieu
        List<Movie> nowShowingMovies = movieRepository.findByStatus(MovieStatus.NOW_SHOWING);
        List<Movie> comingSoonMovies = movieRepository.findByStatus(MovieStatus.COMING_SOON);

        context.append("[DANH SACH PHIM DANG CHIEU]:\n");
        if (nowShowingMovies.isEmpty()) {
            context.append("- Hien chua co phim dang chieu nao duoc cap nhat tren he thong.\n");
        } else {
            for (Movie m : nowShowingMovies) {
                context.append(String.format("- ID: %d | Ten: %s | The loai: %s | Thoi luong: %d phut | Do tuoi: %s | Mo ta: %s\n",
                        m.getId(), m.getTitle(), m.getGenre() != null ? m.getGenre() : "Dang cap nhat",
                        m.getDurationMinutes(), m.getAgeRating() != null ? m.getAgeRating() : "P",
                        m.getDescription() != null ? m.getDescription() : ""));
            }
        }
        context.append("\n");

        context.append("[DANH SACH PHIM SAP CHIEU]:\n");
        if (comingSoonMovies.isEmpty()) {
            context.append("- Hien chua co phim sap chieu.\n");
        } else {
            for (Movie m : comingSoonMovies) {
                context.append(String.format("- ID: %d | Ten: %s | Khoi chieu: %s | The loai: %s\n",
                        m.getId(), m.getTitle(), m.getReleaseDate(), m.getGenre() != null ? m.getGenre() : ""));
            }
        }
        context.append("\n");

        // 2. Suat chieu trong 3 ngay toi
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime endOfRange = LocalDate.now().plusDays(3).atTime(23, 59, 59);
        List<Showtime> upcomingShowtimes = showtimeRepository.findShowtimes(null, null, now, endOfRange);

        context.append("[LICH CHIEU SAP TOI (3 NGAY TOI)]:\n");
        if (upcomingShowtimes.isEmpty()) {
            context.append("- Hien chua co suat chieu nao duoc len lich trong 3 ngay toi.\n");
        } else {
            for (Showtime st : upcomingShowtimes) {
                context.append(String.format("- Suat chieu ID: %d | Phim: %s | Rap: %s (Dia chi: %s) | Phong: %s | Bat dau: %s | Gia co ban: %s VND\n",
                        st.getId(),
                        st.getMovie().getTitle(),
                        st.getAuditorium().getCinema().getName(),
                        st.getAuditorium().getCinema().getAddress(),
                        st.getAuditorium().getName(),
                        st.getStartTime().format(DATE_TIME_FORMATTER),
                        st.getBasePrice().toPlainString()));
            }
        }
        context.append("\n");

        // 3. Danh sach bap nuoc
        List<Product> products = productRepository.findByIsAvailableTrue();
        context.append("[DANH MUC BAP NUOC & COMBO]:\n");
        if (products.isEmpty()) {
            context.append("- Hien chua co thong tin bap nuoc.\n");
        } else {
            for (Product p : products) {
                context.append(String.format("- %s | Gia: %s VND | Mo ta: %s\n",
                        p.getName(), p.getPrice().toPlainString(), p.getDescription() != null ? p.getDescription() : ""));
            }
        }

        return context.toString();
    }
}

