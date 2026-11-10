package com.fintrack.userdata;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface UserDataRepository extends JpaRepository<UserData, UserData.Key> {
    List<UserData> findByUserId(String userId);
    long countByUserId(String userId);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserData d WHERE d.userId = :userId")
    void deleteAllByUserId(String userId);
}
