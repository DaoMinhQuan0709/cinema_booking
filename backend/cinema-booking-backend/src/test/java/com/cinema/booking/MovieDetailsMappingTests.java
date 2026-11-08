package com.cinema.booking;

import com.cinema.booking.repository.MovieRepository;
import jakarta.persistence.Entity;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.hibernate.engine.spi.SessionFactoryImplementor;
import org.hibernate.engine.jdbc.connections.internal.UserSuppliedConnectionProviderImpl;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.data.jpa.repository.Query;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/** Boot the actual ORM mapping and validate HQL, with a provider that cannot connect to any DB. */
class MovieDetailsMappingTests {
    @Test
    void postgresMetadataAndDetailsQueriesAreValidWithoutDatabaseAccess() throws Exception {
        var registry = new StandardServiceRegistryBuilder()
                .applySetting("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect")
                .applySetting("hibernate.boot.allow_jdbc_metadata_access", false)
                .applySetting("hibernate.hbm2ddl.auto", "none")
                .applySetting("hibernate.connection.provider_class", UserSuppliedConnectionProviderImpl.class.getName())
                .build();
        try {
            var sources = new MetadataSources(registry);
            var scanner = new ClassPathScanningCandidateComponentProvider(false);
            scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
            for (var candidate : scanner.findCandidateComponents("com.cinema.booking.entity")) {
                sources.addAnnotatedClass(Class.forName(candidate.getBeanClassName()));
            }
            try (var factory = (SessionFactoryImplementor) sources.buildMetadata().buildSessionFactory()) {
                assertNotNull(factory.getSessionFactoryOptions().getJsonFormatMapper());
                for (var method : MovieRepository.class.getDeclaredMethods()) {
                    var query = method.getAnnotation(Query.class);
                    if (query != null) {
                        var expectedType = query.value().stripLeading().startsWith("SELECT") ? Object[].class : null;
                        assertNotNull(factory.getQueryEngine().getHqlTranslator().translate(query.value(), expectedType));
                    }
                }
            }
        } finally {
            StandardServiceRegistryBuilder.destroy(registry);
        }
    }
}
