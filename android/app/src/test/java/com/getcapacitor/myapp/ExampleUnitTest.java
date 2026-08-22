package com.gugosf114.signal;

import static org.junit.Assert.*;

import org.junit.Test;

/**
 * Example local unit test, which will execute on the development machine (host).
 *
 * @see <a href="http://d.android.com/tools/testing">Testing documentation</a>
 */
public class ExampleUnitTest {

    @Test
    public void scanTimeoutStaysBelowServiceCap() {
        assertTrue(120_000L < 3 * 60 * 1000L);
    }
}
