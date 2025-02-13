package com.capstone.campuseats;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication(exclude = SecurityAutoConfiguration.class)
@EnableAsync
public class CampuseatsApplication {

	public static void main(String[] args) {
		SpringApplication.run(CampuseatsApplication.class, args);
		System.out.println("Server Running...");
	}

}
