package com.cinema.booking.service;

import com.cinema.booking.dto.request.ProductCreateRequest;
import com.cinema.booking.dto.response.ProductResponse;

import java.util.List;

public interface ProductService {

    List<ProductResponse> getAvailableProducts();

    ProductResponse createProduct(ProductCreateRequest request);
}