package com.cinema.booking.controller;

import com.cinema.booking.dto.response.ApiResponse;
import com.cinema.booking.dto.response.ProductResponse;
import com.cinema.booking.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ProductResponse>>> getAvailableProducts() {
        List<ProductResponse> response = productService.getAvailableProducts();
        return ResponseEntity.ok(ApiResponse.success(200, "Lấy danh sách combo bắp nước thành công", response));
    }
}