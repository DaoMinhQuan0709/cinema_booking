package com.cinema.booking.exception;

import com.cinema.booking.dto.response.DeletionPreviewResponse;
import lombok.Getter;

@Getter
public class DeletionBlockedException extends AppException {
    private final DeletionPreviewResponse preview;
    public DeletionBlockedException(DeletionPreviewResponse preview) {
        super(409, preview.blockers().getFirst().message());
        this.preview = preview;
    }
}
