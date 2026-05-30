package org.nexasphere.service.crud;

import org.nexasphere.model.entity.EventEntity;
import org.nexasphere.event.EventCreatedEvent;
import org.nexasphere.event.EventDeletedEvent;
import org.nexasphere.event.EventUpdatedEvent;
import org.nexasphere.repository.EventRepository;
import org.nexasphere.event.AdminEventPublisher;
import org.nexasphere.util.Sanitizer;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Objects;

@Service
public class EventService {

    private final EventRepository repo;
    private final AdminEventPublisher publisher;
    private final Sanitizer sanitizer;

    public EventService(EventRepository repo, AdminEventPublisher publisher, Sanitizer sanitizer) {
        this.repo = repo;
        this.publisher = publisher;
        this.sanitizer = sanitizer;
    }

    public List<EventEntity> getAllEvents() {
        return repo.findAllByOrderByCreatedAtDesc();
    }

    public EventEntity createEvent(EventEntity event, String adminEmail) {
        String safeEmail = Objects.requireNonNull(adminEmail, "adminEmail must not be null");
        sanitize(event);
        event.generateId();
        if (repo.existsById(event.getId())) {
            event.setId(event.getId() + "-" + System.currentTimeMillis());
        }
        EventEntity saved = repo.save(event);
        publisher.publish(new EventCreatedEvent(safeEmail, Objects.requireNonNull(saved)));
        return saved;
    }

    public EventEntity updateEvent(String id, EventEntity updates, String adminEmail) {
        String safeEmail = Objects.requireNonNull(adminEmail, "adminEmail must not be null");
        EventEntity existing = Objects.requireNonNull(
                repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)));

        EventEntity snapshot = snapshot(existing);
        sanitize(updates);

        existing.setName(updates.getName());
        existing.setShortName(updates.getShortName());
        existing.setDateText(updates.getDateText());
        existing.setDescription(updates.getDescription());
        existing.setStatus(updates.getStatus());
        existing.setIcon(updates.getIcon());
        existing.setTags(updates.getTags());

        EventEntity saved = repo.save(existing);
        publisher.publish(new EventUpdatedEvent(safeEmail, snapshot, Objects.requireNonNull(saved)));
        return saved;
    }

    public void deleteEvent(String id, String adminEmail) {
        String safeEmail = Objects.requireNonNull(adminEmail, "adminEmail must not be null");
        EventEntity event = Objects.requireNonNull(
                repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)));
        repo.delete(event);
        publisher.publish(new EventDeletedEvent(safeEmail, event));
    }

    private void sanitize(EventEntity e) {
        e.setName(sanitizer.clean(e.getName()));
        e.setShortName(sanitizer.clean(e.getShortName()));
        e.setDateText(sanitizer.clean(e.getDateText()));
        e.setDescription(sanitizer.clean(e.getDescription()));
    }

    private EventEntity snapshot(EventEntity src) {
        EventEntity copy = new EventEntity();
        copy.setId(src.getId());
        copy.setName(src.getName());
        copy.setShortName(src.getShortName());
        copy.setDateText(src.getDateText());
        copy.setDescription(src.getDescription());
        copy.setStatus(src.getStatus());
        copy.setIcon(src.getIcon());
        copy.setTags(src.getTags() == null ? null : List.copyOf(src.getTags()));
        return copy;
    }
}
