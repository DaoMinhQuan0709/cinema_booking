package com.cinema.booking.dto.response;

import com.cinema.booking.enums.UserRole;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserResponse {

    private Long id;
    private String email;
    private String fullName;
    private String phone;
    private UserRole role;
    private LocalDateTime createdAt;
}